"""Produce resumable local translation drafts for the authored-text inventory.

This is a development tool. Drafts are reviewed and checked before catalogue import;
the game never downloads a model or calls a translation service.
"""
import argparse, collections, json, os, pathlib, re, sys, time
p=argparse.ArgumentParser()
p.add_argument('--tools',required=True)
p.add_argument('--limit',type=int,default=0)
p.add_argument('--batch',type=int,default=32)
p.add_argument('--dll-dir')
p.add_argument('--retry-list')
args=p.parse_args()
tools=pathlib.Path(args.tools).resolve()
sys.path.insert(0,str(tools))
dll_handles=[]
if sys.platform=='win32':
    dll_handles.append(os.add_dll_directory(str(tools/'ctranslate2')))
    if args.dll_dir:dll_handles.append(os.add_dll_directory(str(pathlib.Path(args.dll_dir).resolve())))
import ctranslate2, sentencepiece
root=pathlib.Path(__file__).resolve().parents[2]
model=tools/'model'/'translate-de_en-1_3'
sp=sentencepiece.SentencePieceProcessor(model_file=str(model/'sentencepiece.model'))
translator=ctranslate2.Translator(str(model/'model'),device='cpu',compute_type='int8',inter_threads=1,intra_threads=4)
inventory=json.loads((root/'tools/i18n/inventory.json').read_text(encoding='utf-8'))
outfile=tools/'drafts.json'
drafts=json.loads(outfile.read_text(encoding='utf-8')) if outfile.exists() else {}
pending=[e['text'] for e in inventory['missing'] if e['text'] not in drafts]
if args.retry_list:
    pending=[e['source'] for e in json.loads(pathlib.Path(args.retry_list).read_text(encoding='utf-8'))['issues']]
if args.limit:pending=pending[:args.limit]
protect=re.compile(r'\{\d+\}|https?://[^\s<>]+|[+−±-]?\d[\d.,]*(?:%|×)?')
def prepared(text):
    values=[]
    def replace(match):
        i=len(values);values.append(match.group());return f'KKEEP{i}X'
    return protect.sub(replace,text),values
def restore(text,values):
    errors=[]
    for i,value in enumerate(values):
        marker=f'KKEEP{i}X'
        pattern=re.compile(r'K\s*K\s*E\s*E\s*P\s*'+str(i)+r'\s*X',re.I)
        found=len(pattern.findall(text))
        if found!=1:errors.append(f'placeholder {i}: {found}')
        text=pattern.sub(lambda _:value,text)
    if re.search(r'KKEEP',text,re.I):errors.append('unresolved marker')
    return text,errors
started=time.monotonic()
for at in range(0,len(pending),args.batch):
    keys=pending[at:at+args.batch]
    if args.retry_list:
        # Translate each authored span separately; variables and values never enter the model.
        jobs=[]
        for key in keys:
            fragments=[];last=0
            for match in protect.finditer(key):
                fragments.append((key[last:match.start()],False))
                fragments.append((match.group(),True));last=match.end()
            fragments.append((key[last:],False))
            for text,fixed in fragments:
                if not fixed and text.strip():jobs.append(text)
        results=translator.translate_batch([sp.encode(t.strip(),out_type=str) for t in jobs],beam_size=4,max_batch_size=32,max_input_length=2048,max_decoding_length=2048)
        translations=iter(sp.decode(r.hypotheses[0]) for r in results)
        for key in keys:
            pieces=[];last=0
            def span(text):
                if not text.strip():return text
                value=next(translations)
                return text[:len(text)-len(text.lstrip())]+value+text[len(text.rstrip()):]
            for match in protect.finditer(key):
                pieces.append(span(key[last:match.start()]));pieces.append(match.group());last=match.end()
            pieces.append(span(key[last:]))
            value=''.join(pieces)
            errors=[] if collections.Counter(protect.findall(key))==collections.Counter(protect.findall(value)) else ['numeric or variable mismatch']
            drafts[key]={'text':value,'checks':errors,'method':'protected-spans'}
        outfile.write_text(json.dumps(drafts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({'repaired':at+len(keys),'total':len(pending)}),flush=True)
        continue
    prepared_text=[prepared(key) for key in keys]
    tokens=[sp.encode(text,out_type=str) for text,_ in prepared_text]
    results=translator.translate_batch(tokens,beam_size=4,max_batch_size=args.batch,max_input_length=2048,max_decoding_length=2048)
    for key,(_,values),result in zip(keys,prepared_text,results):
        raw=sp.decode(result.hypotheses[0])
        translated,errors=restore(raw,values)
        if not translated.strip():errors.append('empty translation')
        # Matching exact numeric tokens catches omissions, additions, and changed percentages.
        if collections.Counter(protect.findall(key))!=collections.Counter(protect.findall(translated)):errors.append('numeric or variable mismatch')
        drafts[key]={'text':translated,'checks':errors}
    outfile.write_text(json.dumps(drafts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'done':len(drafts),'remaining':len(pending)-at-len(keys),'seconds':round(time.monotonic()-started),'flagged':sum(bool(d['checks']) for d in drafts.values())}),flush=True)
print(json.dumps({'output':str(outfile),'sample':list(drafts.items())[:8]},ensure_ascii=False),flush=True)
