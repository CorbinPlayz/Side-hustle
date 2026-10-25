import asyncio, os
from playwright.async_api import async_playwright
D=os.path.dirname(os.path.abspath(__file__)); MOCKT=open(os.path.join(D,'mockthree.js')).read()
B='http://localhost:8765/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1200,'height':800})
        async def route(r):
            u=r.request.url
            if 'three' in u and 'cdnjs' in u: await r.fulfill(body=MOCKT,content_type='application/javascript')
            elif u.startswith('http://localhost'): await r.continue_()
            else: await r.abort()
        await ctx.route('**/*',route)
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(B+'play.html'); await pg.wait_for_selector('#scr-mode:not([hidden])')
        print('demo mode level',await pg.inner_text('#pLvl'))
        await pg.click('#btnLocal'); await pg.click('#toWait'); await pg.wait_for_selector('#scr-match:not([hidden])')
        await pg.wait_for_timeout(4200); await pg.keyboard.down('KeyW'); await pg.wait_for_timeout(800); await pg.keyboard.up('KeyW')
        print('local clock',await pg.inner_text('#clock'))
        # force an end: score limit reached
        await pg.evaluate('M.players[0].score=99;M.over=true')
        await pg.wait_for_selector('#scr-results:not([hidden])'); await pg.wait_for_timeout(1500)
        print('local result:',await pg.inner_text('#resultTitle'),'xp gain',await pg.inner_text('#xpGain'))
        await pg.goto(B+'login.html'); await pg.wait_for_timeout(500)
        print('login demo note visible:',await pg.evaluate('!document.getElementById("demoNote").hidden'))
        await pg.goto(B+'leaderboard.html'); await pg.wait_for_timeout(1200); print('lb rows',await pg.evaluate('document.querySelectorAll(".lbrow").length'))
        print('ERR',errs); await b.close()
asyncio.run(main())
