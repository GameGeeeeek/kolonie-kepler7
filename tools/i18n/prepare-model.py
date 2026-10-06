"""Development-only local translation model; nothing is loaded by the game."""
import hashlib, json, pathlib, sys, urllib.request, urllib.error, zipfile
cache=pathlib.Path(sys.argv[1]).resolve()
cache.mkdir(parents=True,exist_ok=True)
index=json.load(urllib.request.urlopen('https://raw.githubusercontent.com/argosopentech/argospm-index/main/index.json',timeout=30))
package=next(p for p in index if p['from_code']=='de' and p['to_code']=='en')
url=next(link for link in package['links'] if link.startswith('https://'))
archive=cache/'de-en.argosmodel'
if not archive.exists():
    try:
        urllib.request.urlretrieve(url,archive)
    except urllib.error.HTTPError as error:
        if error.code!=403:
            raise
        url='https://data.argosopentech.com/argospm/v1/'+url.rsplit('/',1)[-1]
        urllib.request.urlretrieve(url,archive)
target=cache/'model'
target.mkdir(exist_ok=True)
with zipfile.ZipFile(archive) as z:
    for info in z.infolist():
        resolved=(target/info.filename).resolve()
        if not resolved.is_relative_to(target):
            raise ValueError('Archive entry escapes model directory')
    z.extractall(target)
metadata={'url':url,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'package_version':package['package_version']}
(cache/'model-source.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'source':metadata,'files':[str(p.relative_to(target)) for p in target.rglob('*') if p.is_file()]}),flush=True)
