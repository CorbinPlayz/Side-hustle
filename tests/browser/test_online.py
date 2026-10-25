import asyncio, json, os
from playwright.async_api import async_playwright
D=os.path.dirname(os.path.abspath(__file__))
rd=lambda f:open(os.path.join(D,f)).read()
MOCKT=rd('mockthree.js'); CORE=rd('matchcore.browser.js'); FAKE=rd('fakeserver.js')
B='http://localhost:8765/'
PROFILE={"id":7,"username":"Tester","status":"approved","is_admin":False,"xp":0,"wins":0,"losses":0,"kills":0,"deaths":0,"loadout":[]}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1200,'height':800})
        async def route(r):
            u=r.request.url
            if 'three' in u and 'cdnjs' in u: await r.fulfill(body=MOCKT,content_type='application/javascript')
            elif '/api/me' in u: await r.fulfill(body=json.dumps({"profile":PROFILE}),content_type='application/json')
            elif u.startswith('http://localhost'): await r.continue_()
            else: await r.abort()
        await ctx.route('**/*',route)
        pg=await ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m:m.type=='error' and errs.append('console:'+m.text))
        await pg.goto(B+'play.html'); await pg.wait_for_selector('#scr-mode:not([hidden])')
        await pg.evaluate(CORE); await pg.evaluate(FAKE)
        print('signed in as',await pg.inner_text('#pName'),'level',await pg.inner_text('#pLvl'))
        await pg.click('#btnOnline'); await pg.click('#btnCreate'); await pg.select_option('#scoreLimit','3'); await pg.click('#toWait')
        await pg.wait_for_function('document.getElementById("startOnline").disabled===false',timeout=5000)
        print('room code:',await pg.inner_text('#waitCode'),'| status:',await pg.inner_text('#waitStatus'))
        print('settings pushed to server:',await pg.evaluate('JSON.stringify(Object.values(window.__cores)[0].settings)'))
        await pg.click('#startOnline'); await pg.wait_for_selector('#scr-match:not([hidden])',timeout=5000)
        await pg.wait_for_timeout(4500)
        print('server phase:',await pg.evaluate('Object.values(window.__cores)[0].phase'),'| clock:',await pg.inner_text('#clock'),'| ping:',await pg.inner_text('#ping0'))
        # walk forward; the server must move us
        await pg.mouse.click(600,400)
        await pg.keyboard.down('KeyW'); await pg.wait_for_timeout(1500); await pg.keyboard.up('KeyW')
        pos=await pg.evaluate('(function(){var M=Object.values(window.__cores)[0].M;return [M.players[0].x,M.players[0].z]})()')
        sp=await pg.evaluate('(function(){var M=Object.values(window.__cores)[0].M;return [M.world.spawns[0].x,M.world.spawns[0].z]})()')
        print('server moved my player:',round(((pos[0]-sp[0])**2+(pos[1]-sp[1])**2)**.5,1),'m')
        # opponent leaves -> forfeit with XP
        await pg.evaluate('(function(){var c=Object.values(window.__cores)[0];c.elapsed=60;c.M.players[0].score=2;c.leave(window.__bot)})()')
        await pg.wait_for_selector('#scr-results:not([hidden])',timeout=5000); await pg.wait_for_timeout(1800)
        print('results:',await pg.inner_text('#resultTitle'),'|',await pg.inner_text('#resultBody'))
        print('xp box visible:',await pg.evaluate('!document.getElementById("xpBox").hidden'),'gain',await pg.inner_text('#xpGain'),'| rematch:',await pg.inner_text('#rematch'))
        await pg.click('#toMenu'); await pg.wait_for_selector('#scr-mode:not([hidden])')
        # join missing room shows the server error
        await pg.click('#btnOnline'); await pg.click('#btnJoin'); await pg.fill('#joinCode','ZZZZ9'); await pg.click('#joinGo'); await pg.wait_for_timeout(600)
        print('join missing:',await pg.inner_text('#joinErr'))
        print('ERR',errs)
        await b.close()
asyncio.run(main())
