import copy
from pathlib import Path
import unittest

import yaml
import merge_readiness as gate

SHA = 'a' * 40
PATH = '.github/workflows/test.yml'

def pull():
    return {'number':1,'state':'open','draft':False,'changed_files':1,'merge_commit_sha':'c'*40,
        'head':{'sha':SHA,'ref':'codex/example','repo':{'full_name':'owner/repo'}},
        'base':{'sha':'b'*40,'ref':'main','repo':{'full_name':'owner/repo'}},
        'body':f'## Review\nReview-Ergebnis: bestanden\nCode, test coverage and failure handling inspected.\n<!-- self-review: {SHA} -->'}

def run(**overrides):
    return {**{'id':1,'head_sha':SHA,'head_branch':'codex/example','event':'pull_request','path':PATH,
        'status':'completed','conclusion':'success','run_attempt':1}, **overrides}

class ReadinessTests(unittest.TestCase):
    def evaluate(self, runs=None, jobs=None, pr=None, reviews=None, threads=None, required=None):
        return gate.verdict({PATH} if required is None else required,
            [run()] if runs is None else runs,
            {1:[{'status':'completed','conclusion':'success','runner_name':'pc'}]} if jobs is None else jobs,
            pull() if pr is None else pr, reviews or [], threads or [])[0]

    def test_completed_ci_and_exact_head_review_pass(self):
        self.assertEqual(self.evaluate(), 'success')

    def test_missing_ci_waits(self):
        self.assertEqual(self.evaluate(runs=[]), 'pending')

    def test_queued_ci_waits(self):
        self.assertEqual(self.evaluate(runs=[run(status='queued',conclusion=None)]), 'pending')

    def test_failed_cancelled_or_skipped_workflow_blocks(self):
        for result in ('failure','cancelled','timed_out','skipped','action_required'):
            with self.subTest(result=result):
                self.assertEqual(self.evaluate(runs=[run(conclusion=result)]), 'failure')

    def test_green_summary_with_failed_job_blocks(self):
        self.assertEqual(self.evaluate(jobs={1:[{'status':'completed','conclusion':'failure','runner_name':'pc'},
            {'status':'completed','conclusion':'success','runner_name':'pc'}]}), 'failure')

    def test_empty_or_all_skipped_workflow_is_not_evidence(self):
        for jobs in ({}, {1:[]}, {1:[{'status':'completed','conclusion':'skipped','runner_name':''}]}):
            self.assertEqual(self.evaluate(jobs=jobs), 'failure')

    def test_latest_failed_attempt_cannot_use_old_green(self):
        self.assertEqual(self.evaluate(runs=[run(),run(id=2,conclusion='failure')]), 'failure')

    def test_old_head_and_wrong_branch_do_not_count(self):
        self.assertEqual(self.evaluate(runs=[run(head_sha='d'*40)]), 'pending')
        self.assertEqual(self.evaluate(runs=[run(head_branch='different')]), 'pending')

    def test_exact_head_manual_github_fallback_counts(self):
        self.assertEqual(self.evaluate(runs=[run(event='workflow_dispatch')]), 'success')

    def test_new_pr_workflow_cannot_hide_failure(self):
        self.assertEqual(self.evaluate(runs=[run(),run(id=2,path='.github/workflows/new.yml',conclusion='failure')]), 'failure')

    def test_gate_workflow_itself_does_not_recurse(self):
        self.assertEqual(self.evaluate(runs=[run(),run(id=2,path=gate.SELF,status='in_progress',conclusion=None)]), 'success')

    def test_missing_or_stale_review_marker_waits(self):
        for body in ('', pull()['body'].replace(SHA, 'f'*40), f'<!-- self-review: {SHA} -->'):
            pr=pull();pr['body']=body
            self.assertEqual(self.evaluate(pr=pr), 'pending')

    def test_open_review_thread_waits(self):
        self.assertEqual(self.evaluate(threads=[{'isResolved':False}]), 'pending')
        self.assertEqual(self.evaluate(threads=[{'isResolved':True}]), 'success')

    def test_comment_does_not_clear_requested_changes(self):
        reviews=[{'id':1,'state':'CHANGES_REQUESTED','user':{'login':'reviewer'}},
                 {'id':2,'state':'COMMENTED','user':{'login':'reviewer'}}]
        self.assertEqual(self.evaluate(reviews=reviews), 'pending')
        self.assertEqual(self.evaluate(reviews=reviews+[{'id':3,'state':'APPROVED','user':{'login':'reviewer'}}]), 'success')

    def test_draft_closed_and_fork_do_not_pass(self):
        for field,value in [('draft',True),('state','closed')]:
            pr=pull();pr[field]=value
            self.assertEqual(self.evaluate(pr=pr), 'pending')
        pr=pull();pr['head']['repo']['full_name']='foreign/repo'
        self.assertEqual(self.evaluate(pr=pr), 'failure')

    def test_data_only_pr_can_pass_with_review(self):
        self.assertEqual(self.evaluate(required=set(),runs=[],jobs={}), 'success')

    def test_glob_path_boundaries_and_ordered_negation(self):
        self.assertTrue(gate.glob_match('tests/deep/test.js','tests/**'))
        self.assertTrue(gate.glob_match('test.js','**/test.js'))
        self.assertTrue(gate.glob_match('a/b/test.js','**/test.js'))
        self.assertFalse(gate.glob_match('tests/deep/test.js','tests/*.js'))
        self.assertFalse(gate.matches('docs/a.md',['**','!docs/**']))
        self.assertTrue(gate.matches('docs/a.md',['**','!docs/**','docs/a.md']))

    def test_trigger_paths_and_renames(self):
        doc={'on':{'pull_request':{'branches':['main'],'paths':['tests/**']}}}
        self.assertTrue(gate.required_workflow(doc,pull(),['tests/test.js'],PATH))
        self.assertFalse(gate.required_workflow(doc,pull(),['docs/guide.md'],PATH))
        doc['on']['pull_request']={'paths-ignore':['operations/**']}
        self.assertFalse(gate.required_workflow(doc,pull(),['operations/ui.js'],PATH))
        self.assertTrue(gate.required_workflow(doc,pull(),['operations/ui.js','game.js'],PATH))

    def test_full_suite_exception_only_matches_exact_existing_condition(self):
        doc={'on':{'pull_request':{}},'jobs':{'complete-suite':{'if':gate.FULL_CONDITION}}}
        self.assertFalse(gate.required_workflow(doc,pull(),['game.js'],gate.FULL))
        pr=pull();pr['head']['ref']='codex/ship-sharpness'
        self.assertTrue(gate.required_workflow(doc,pr,['game.js'],gate.FULL))
        doc['jobs']['complete-suite']['if']='true'
        self.assertTrue(gate.required_workflow(doc,pull(),['game.js'],gate.FULL))

class ActualWorkflowTests(unittest.TestCase):
    def test_existing_workflow_globs_are_supported(self):
        workflow_dir=Path(__file__).resolve().parents[1]/'workflows'
        for path in workflow_dir.glob('*.yml'):
            doc=yaml.load(path.read_text(encoding='utf-8'),Loader=yaml.BaseLoader)
            for event in (doc.get('on') or {}).values():
                if not isinstance(event,dict): continue
                for key in ('paths','paths-ignore','branches','branches-ignore'):
                    for pattern in event.get(key,[]):
                        gate.glob_match('some/file',pattern.lstrip('!'))

class EvidenceTests(unittest.TestCase):
    class Client:
        def __init__(self, fresh=None, file_count=1):
            self.fresh=fresh or pull();self.file_count=file_count
        def pages(self,path,key=None):
            if path.endswith('/files'): return [{'filename':'docs/guide.md'}]*self.file_count
            if path.endswith('/reviews'): return []
            if path.startswith('actions/runs?'): return []
            raise AssertionError(path)
        def request(self,path):
            if path.startswith('contents/.github/workflows?'): return []
            if path=='pulls/1': return self.fresh
            raise AssertionError(path)
        def threads(self,number): return []

    def test_stable_documentation_pr_passes_live_evidence(self):
        self.assertEqual(gate.inspect(self.Client(),pull())[0],'success')

    def test_head_base_body_or_state_race_cannot_pass(self):
        for mutation in ('head','base','body','draft','state'):
            fresh=pull()
            if mutation in ('head','base'): fresh[mutation]['sha']='e'*40
            elif mutation=='body': fresh['body']+=' changed'
            elif mutation=='draft': fresh['draft']=True
            else: fresh['state']='closed'
            with self.subTest(mutation=mutation):
                self.assertEqual(gate.inspect(self.Client(fresh),pull())[0],'pending')

    def test_incomplete_file_evidence_fails_closed(self):
        with self.assertRaisesRegex(ValueError,'incomplete'):
            gate.inspect(self.Client(file_count=0),pull())

    def test_file_api_limit_cannot_pass(self):
        pr=pull();pr['changed_files']=3001
        self.assertEqual(gate.inspect(self.Client(),pr)[0],'failure')

    def test_unknown_glob_is_rejected(self):
        with self.assertRaisesRegex(ValueError,'Unsupported'):
            gate.glob_match('file.js','[a-z]*.js')

if __name__ == '__main__':
    unittest.main()
