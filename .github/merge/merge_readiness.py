"""Publish a fail-closed merge status; never execute or check out PR code."""
from __future__ import annotations

import base64
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

import yaml

CONTEXT = 'Merge readiness'
SELF = '.github/workflows/merge-readiness.yml'
FULL = '.github/workflows/kepler-graphics-full-review.yml'
FULL_BRANCHES = {'codex/interface-clarity', 'codex/ship-sharpness', 'codex/mobile-settings-compact'}
FULL_CONDITION = "github.event_name != 'pull_request' || (!github.event.pull_request.draft && (github.head_ref == 'codex/interface-clarity' || github.head_ref == 'codex/ship-sharpness' || github.head_ref == 'codex/mobile-settings-compact'))"


class GitHub:
    def __init__(self, repository, token):
        self.repository, self.token = repository, token
        self.base = os.environ.get('GITHUB_API_URL', 'https://api.github.com')

    def request(self, endpoint, body=None, graphql=False):
        url = self.base + ('/graphql' if graphql else '/repos/' + self.repository + '/' + endpoint)
        request = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
            headers={'Authorization': 'Bearer ' + self.token, 'Accept': 'application/vnd.github+json',
                     'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28'})
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)

    def pages(self, endpoint, key=None):
        output = []
        for page in range(1, 101):
            data = self.request(endpoint + ('&' if '?' in endpoint else '?') + f'per_page=100&page={page}')
            batch = data[key] if key else data
            output.extend(batch)
            if len(batch) < 100:
                return output
        raise ValueError('Pagination limit exceeded; cannot establish complete evidence')

    def threads(self, number):
        owner, name = self.repository.split('/')
        query = '''query($owner:String!,$name:String!,$number:Int!,$cursor:String) {
          repository(owner:$owner,name:$name) { pullRequest(number:$number) {
            reviewThreads(first:100,after:$cursor) {
              nodes { isResolved } pageInfo { hasNextPage endCursor }
            }
          } }
        }'''
        cursor, threads = None, []
        for _ in range(100):
            data = self.request('', {'query':query,'variables':{'owner':owner,'name':name,'number':number,'cursor':cursor}}, graphql=True)
            if data.get('errors'):
                raise ValueError('Review-thread query failed')
            connection = data['data']['repository']['pullRequest']['reviewThreads']
            threads.extend(connection['nodes'])
            if not connection['pageInfo']['hasNextPage']:
                return threads
            cursor = connection['pageInfo']['endCursor']
        raise ValueError('Review-thread pagination limit exceeded')


def glob_match(value, pattern):
    """The path globs used by these repositories, including **/ and ordered !."""
    pieces, index = [], 0
    while index < len(pattern):
        char = pattern[index]
        if char == '*':
            if pattern[index:index+2] == '**':
                index += 1
                if pattern[index+1:index+2] == '/':
                    pieces.append('(?:.*/)?')
                    index += 1
                else:
                    pieces.append('.*')
            else:
                pieces.append('[^/]*')
        elif char == '?':
            pieces.append('[^/]')
        elif char in '[]+\\':
            raise ValueError('Unsupported workflow glob: ' + pattern)
        else:
            pieces.append(re.escape(char))
        index += 1
    return re.fullmatch(''.join(pieces), value) is not None


def matches(value, patterns):
    selected = False
    for pattern in patterns:
        negative = pattern.startswith('!')
        if glob_match(value, pattern[1:] if negative else pattern):
            selected = not negative
    return selected


def required_workflow(document, pull, files, path):
    if path == SELF:
        return False
    events = document.get('on', {})
    if isinstance(events, str):
        events = {events: {}}
    elif isinstance(events, list):
        events = dict.fromkeys(events, {})
    if 'pull_request' not in events:
        return False
    trigger = events['pull_request'] or {}
    branch = pull['base']['ref']
    if 'branches' in trigger and not matches(branch, trigger['branches']):
        return False
    if 'branches-ignore' in trigger and matches(branch, trigger['branches-ignore']):
        return False
    if (path == FULL and document.get('jobs', {}).get('complete-suite', {}).get('if') == FULL_CONDITION
            and pull['head']['ref'] not in FULL_BRANCHES):
        # Existing full-suite job explicitly restricts these three PR branches.
        return False
    if 'paths' in trigger and not any(matches(f, trigger['paths']) for f in files):
        return False
    if 'paths-ignore' in trigger and all(matches(f, trigger['paths-ignore']) for f in files):
        return False
    return True


def review_problem(pull, reviews, threads):
    sha = pull['head']['sha']
    marker = f'<!-- self-review: {sha} -->'
    body = pull.get('body') or ''
    if marker not in body or not re.search(r'^Review-Ergebnis:\s*bestanden\s*$', body, re.M | re.I):
        return 'Document the completed self-review for this exact head commit'
    latest = {}
    for review in sorted(reviews, key=lambda r: r['id']):
        if review['state'] in {'APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'}:
            latest[review['user']['login']] = review['state']
    if 'CHANGES_REQUESTED' in latest.values():
        return 'A GitHub review still requests changes'
    if any(not thread['isResolved'] for thread in threads):
        return 'Resolve all open GitHub review threads'
    return None


def verdict(required, runs, jobs, pull, reviews, threads):
    required = set(required)
    if pull.get('draft') or pull['state'] != 'open' or pull['base']['ref'] != 'main':
        return 'pending', 'PR must be open, ready for review, and target main'
    if pull['head']['repo']['full_name'] != pull['base']['repo']['full_name']:
        return 'failure', 'Automatic merge is limited to branches in this repository'
    sha = pull['head']['sha']
    candidates = {}
    for run in runs:
        if run['head_sha'] != sha or run['event'] not in {'pull_request', 'workflow_dispatch', 'push'}:
            continue
        if run['head_branch'] != pull['head']['ref']:
            continue
        path = run['path'].split('@', 1)[0]
        if path == SELF:
            continue
        # Additional PR workflows also count, even if newly added or renamed.
        if run['event'] == 'pull_request' and path != FULL:
            required.add(path)
        if path not in candidates or (run['id'], run.get('run_attempt', 1)) > (candidates[path]['id'], candidates[path].get('run_attempt', 1)):
            candidates[path] = run
    pending, failures = [], []
    for path in sorted(required):
        run = candidates.get(path)
        if not run or run['status'] != 'completed':
            pending.append(Path(path).stem)
            continue
        if run['conclusion'] != 'success':
            failures.append(Path(path).stem + ': ' + str(run['conclusion']))
            continue
        actual = jobs.get(run['id'], [])
        if not actual or not any(j['conclusion'] == 'success' and j.get('runner_name') for j in actual):
            failures.append(Path(path).stem + ': no executed successful job')
        elif any(j['status'] != 'completed' for j in actual):
            pending.append(Path(path).stem)
        elif any(j['conclusion'] not in {'success', 'skipped'} for j in actual):
            failures.append(Path(path).stem + ': failed job')
    if failures:
        return 'failure', 'CI failed: ' + ', '.join(failures)
    if pending:
        return 'pending', 'Waiting for CI: ' + ', '.join(pending)
    problem = review_problem(pull, reviews, threads)
    if problem:
        return 'pending', problem
    return 'success', 'All applicable CI passed; exact-head review recorded; review threads resolved'


def inspect(client, pull):
    number, sha = pull['number'], pull['head']['sha']
    if pull.get('draft') or pull['state'] != 'open' or pull['base']['ref'] != 'main':
        return 'pending', 'PR must be open, ready for review, and target main'
    if pull['head']['repo']['full_name'] != pull['base']['repo']['full_name']:
        return 'failure', 'Automatic merge is limited to branches in this repository'
    if pull['changed_files'] > 3000:
        return 'failure', 'PR exceeds GitHub changed-file evidence limit'
    files_data = client.pages(f'pulls/{number}/files')
    if len(files_data) != pull['changed_files']:
        raise ValueError('Changed-file evidence incomplete')
    files = [f['filename'] for f in files_data]
    files += [f['previous_filename'] for f in files_data if f.get('previous_filename')]
    # Read the actual tested merge tree. Base policy also protects workflows
    # removed/disabled by a PR; deleting CI must not silently waive its checks.
    refs = {pull['base']['sha'], sha}
    if pull.get('merge_commit_sha'):
        refs.add(pull['merge_commit_sha'])
    required = set()
    for ref in refs:
        listing = client.request('contents/.github/workflows?ref=' + ref)
        for entry in listing:
            if not entry['name'].endswith(('.yml', '.yaml')) or entry['path'] == SELF:
                continue
            item = client.request('contents/' + entry['path'] + '?ref=' + ref)
            document = yaml.load(base64.b64decode(item['content']), Loader=yaml.BaseLoader)
            if not isinstance(document, dict):
                raise ValueError('Invalid workflow document')
            if required_workflow(document, pull, files, entry['path']):
                required.add(entry['path'])
    runs = client.pages('actions/runs?head_sha=' + sha, 'workflow_runs')
    relevant = [r for r in runs if r['head_sha'] == sha and r['status'] == 'completed' and r['conclusion'] == 'success' and r['path'].split('@', 1)[0] != SELF]
    jobs = {r['id']: client.pages(f'actions/runs/{r["id"]}/jobs', 'jobs') for r in relevant}
    reviews = client.pages(f'pulls/{number}/reviews')
    threads = client.threads(number)
    state, description = verdict(required, runs, jobs, pull, reviews, threads)
    # Do not publish a green result for a head or base that changed mid-query.
    fresh = client.request(f'pulls/{number}')
    if (fresh['head']['sha'], fresh['base']['sha'], fresh['draft'], fresh.get('body'), fresh['state']) != (sha, pull['base']['sha'], pull['draft'], pull.get('body'), pull['state']):
        return 'pending', 'PR changed during validation; repeat the readiness check'
    return state, description


def main():
    repository = os.environ['GITHUB_REPOSITORY']
    client = GitHub(repository, os.environ['GH_TOKEN'])
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text(encoding='utf-8'))
    number = os.environ.get('PR_NUMBER') or event.get('pull_request', {}).get('number')
    pulls = [client.request(f'pulls/{int(number)}')] if number else client.pages('pulls?state=open&base=main')
    had_error = False
    for summary in pulls:
        pull = client.request(f'pulls/{summary["number"]}')
        if pull['state'] != 'open' or pull['base']['ref'] != 'main':
            continue
        try:
            state, description = inspect(client, pull)
        except Exception as error:
            state, description = 'error', 'Readiness evidence unavailable: ' + type(error).__name__
            had_error = True
            print(json.dumps({'pr':pull['number'], 'error':type(error).__name__, 'detail':str(error)[:300]}), file=sys.stderr)
        description = description[:140]
        statuses = client.pages('commits/' + pull['head']['sha'] + '/statuses')
        existing = next((s for s in statuses if s['context'] == CONTEXT), None)
        if not existing or (existing['state'], existing['description']) != (state, description):
            client.request('statuses/' + pull['head']['sha'], {'state':state, 'context':CONTEXT, 'description':description,
                'target_url':f'https://github.com/{repository}/actions/runs/{os.environ["GITHUB_RUN_ID"]}'})
        print(json.dumps({'pr':pull['number'], 'head':pull['head']['sha'], 'state':state, 'description':description}))
    return int(had_error)


if __name__ == '__main__':
    sys.exit(main())
