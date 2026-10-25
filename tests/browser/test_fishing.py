import asyncio,sys
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
        shot=lambda n: pg.screenshot(path=f'/tmp/p{n}.png',timeout=180000)
        await D('d.player.pitch=-.3')
        await pg.wait_for_timeout(1500); await shot(0)
        await D('d.fishing.press();d.fishing.release()'); await D('d.advance(1.2)')
        print('after cast',await D('return d.fishing.state'),await D('return document.getElementById("toasts").innerText'))
        await D('d.advance(1.2)'); print('after fly',await D('return d.fishing.state')); await shot(1)
        await D('d.fishing.wait=.1;d.advance(.6)'); print('bite?',await D('return d.fishing.state')); await shot(2)
        await D('d.fishing.press()'); await D('d.advance(.2)'); print('hook',await D('return d.fishing.state'))
        for i in range(400):
            if await D('return d.fishing.state')!='reeling': break
            t,z=await D('return [d.fishing.reel.tension,d.fishing.reel.zoneC]')
            if t<z: await D('d.fishing.held=true')
            else: await D('d.fishing.held=false')
            await D('d.advance(.1)')
            if i==20: await shot(3)
        await D('d.fishing.release()')
        print('end',await D('return d.fishing.state'),'bag',await D('return d.eco.bag.length'),await D('return document.getElementById("toasts").innerText'))
        await D('d.advance(.8)'); await shot(4)
        await D('d.advance(1.5)')
        # walk to stall and open market
        await D('d.eco.money=500;d.player.x=d.stallPos.x+Math.cos(d.dockA)*7;d.player.z=d.stallPos.z+Math.sin(d.dockA)*7;d.player.yaw=Math.atan2(Math.cos(d.dockA),Math.sin(d.dockA));d.player.pitch=-.12')
        await D('d.advance(.1)'); await pg.wait_for_timeout(1500); await shot(5)
        await D('d.player.x=d.stallPos.x+Math.cos(d.dockA)*3;d.player.z=d.stallPos.z+Math.sin(d.dockA)*3')
        await pg.keyboard.press('KeyE'); await pg.wait_for_timeout(800); print('market open',await D('return d.hud.marketOpen'))
        print(errs[:6]); await b.close()
asyncio.run(main())
