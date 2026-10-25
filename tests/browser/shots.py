import asyncio,sys,os
from playwright.async_api import async_playwright
V='../vendor/'
async def main():
    shots=sys.argv[1:] or ['1']
    async with async_playwright() as p:
        b=await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        ctx=await b.new_context(viewport={'width':1100,'height':620})
        async def route(r):
            u=r.request.url
            if 'three.module.min.js' in u: await r.fulfill(body=open(V+'three.module.min.js').read(),content_type='application/javascript')
            elif 'three.core' in u: await r.fulfill(body=open(V+'three.core.min.js').read(),content_type='application/javascript')
            elif u.startswith('http://localhost'): await r.continue_()
            else: await r.abort()
        await ctx.route('**/*',route)
        for s in shots:
            pg=await ctx.new_page(); errs=[]
            pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
            await pg.goto(f'http://localhost:8767/world.html?shot={s}&fixed=1')
            try: await pg.wait_for_function('window.__frames>3',timeout=120000)
            except Exception as e: errs.append('timeout')
            await pg.wait_for_timeout(1500)
            await pg.screenshot(path=f'/tmp/world{s}.png'); print(s,errs[:5]); await pg.close()
        await b.close()
asyncio.run(main())
