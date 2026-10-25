import asyncio
from playwright.async_api import async_playwright
V='../vendor/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        ctx=await b.new_context(viewport={'width':900,'height':506})
        async def route(r):
            u=r.request.url
            if 'three.module.min.js' in u: await r.fulfill(body=open(V+'three.module.min.js').read(),content_type='application/javascript')
            elif 'three.core' in u: await r.fulfill(body=open(V+'three.core.min.js').read(),content_type='application/javascript')
            elif u.startswith('http://localhost'): await r.continue_()
            else: await r.abort()
        await ctx.route('**/*',route)
        pg=await ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8767/world.html?fixed=1&lq=1')
        await pg.wait_for_function('window.__dev&&window.__frames>2',timeout=120000)
        D=lambda js: pg.evaluate('(()=>{const d=window.__dev;'+js+'})()')
        shot=lambda n: pg.screenshot(path=f'/tmp/j{n}.png',timeout=180000)
        # find a tree on land and stand 3m south of it looking north
        await D('''const g=d.jobs.trees[0];const o=g.list.find(t=>t[1]>6);d.player.x=o[0];d.player.z=o[2]+3;d.player.yaw=0;d.player.pitch=-.05;d.player.y=o[1]+1.7;window.__tree=o;
          document.dispatchEvent(new KeyboardEvent('keydown',{code:'Digit2'}));window.dispatchEvent(new KeyboardEvent('keydown',{code:'Digit2'}))''')
        print('tool',await D('return d.jobs.tool'))
        await D('d.advance(.5)'); await pg.wait_for_timeout(500); await shot(1)
        hits=0
        for i in range(400):
            await D('d.advance(.05)')
            inz=await D('const j=d.jobs;return Math.abs(j.sweep-j.zoneC)<.1')
            if inz:
                await D('d.jobs.press(d.player.x,d.player.z)'); await D('d.advance(.15)')
                if await D('return d.jobs.falling.length')>0: break
        print('falling',await D('return d.jobs.falling.length'),'bag',await D('return d.eco.bag.map(x=>x.id).join(",")'))
        await D('d.advance(.6)'); await pg.wait_for_timeout(300); await shot(2)
        await D('d.advance(1.2)'); await shot(3)
        # mushroom
        await D('''const n=d.jobs.nodes[0],o=n.list[0];d.player.x=o.x;d.player.z=o.z+1.6;d.player.y=o.y+1.7;d.player.yaw=0;d.player.pitch=-.5;d.advance(.2)''')
        await pg.wait_for_timeout(400); await shot(4)
        print('pick',await D('return d.jobs.pickMushroom(d.player.x,d.player.z)'),'bag',await D('return d.eco.bag.length'))
        await D('d.advance(.5)'); await shot(5)
        print(errs[:5]); await b.close()
asyncio.run(main())
