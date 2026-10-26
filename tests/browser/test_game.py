import asyncio,sys
from playwright.async_api import async_playwright
V='/home/claude/side-hustle/tests/vendor/'
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
        try: await pg.wait_for_function('window.__dev&&window.__frames>2',timeout=150000)
        except Exception as e: print('NOLOAD',errs); return
        D=lambda js: pg.evaluate('(()=>{const d=window.__dev;'+js+'})()')
        print('errs',errs)
        print('plots',await D('return d.town.plots.map(p=>[p.x,p.z,p.y.toFixed(1)].join(",")).join(" | ")'))
        print('pickups',await D('return d.pickups.items.length'))
        await pg.screenshot(path='/tmp/g1.png',timeout=180000)
        # pick up a shell
        await D('''const it=d.pickups.items.find(i=>i.id==="shell");d.player.x=it.x;d.player.z=it.z+1.2;d.player.y=it.y+1.7;d.player.yaw=0;d.player.pitch=-.6;d.advance(.3)''')
        await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/g2.png',timeout=180000)
        await pg.keyboard.press('KeyE'); await D('d.advance(.2)')
        print('bag',await D('return d.eco.bag.map(x=>x.id).join(",")'))
        print('errs',errs)
        # give money, buy plot, build
        await D('d.eco.money=5000;const p=d.town.plots[0];d.player.x=p.x-6;d.player.z=p.z+11;d.player.y=p.y+1.7;d.player.yaw=0;d.player.pitch=-.3;d.advance(.2)')
        await pg.keyboard.press('KeyE'); await D('d.advance(.2)')
        print('plot',await D('return d.eco.myPlot'),'money',await D('return d.eco.money'))
        await pg.keyboard.press('KeyB'); await D('d.advance(.1)')
        print('build active',await D('return d.builder.active'))
        # place a floor grid, walls, roof
        await D('''const b=d.builder,p=d.town.plots[d.eco.myPlot];
          const put=(sel,x,z,r)=>{b.sel=sel;b.ghostT=null;b.pos={x,z,r};b.valid=true;b.active=true;b.place()};
          for(let i=0;i<3;i++)for(let j=0;j<3;j++)put(0,-3+i*2,-3+j*2,0);
          for(let i=0;i<3;i++){put(1,-3+i*2,-4,0);put(i==1?2:1,-3+i*2,2,0)}
          for(let j=0;j<3;j++){put(1,-4,-3+j*2,Math.PI/2);put(j==1?3:1,2,-3+j*2,Math.PI/2)}
          for(let i=0;i<3;i++)for(let j=0;j<3;j++)put(4,-3+i*2,-3+j*2,0);
          put(5,-1,-1,0);put(6,0,-1.5,0.5);put(7,-3,-2,0);put(8,0,0.5,0);put(9,-3.5,1,0);put(10,0,-.5,0)''')
        print('pieces',await D('return d.eco.pieces.length'),'money',await D('return d.eco.money'))
        await D('''const p=d.town.plots[d.eco.myPlot];d.player.x=p.x+2;d.player.z=p.z+12;d.player.y=p.y+1.7;d.player.yaw=0;d.player.pitch=-.18;d.builder.setActive(false);d.advance(.3)''')
        await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/g3.png',timeout=180000)
        # npc event
        await D('d.eco.earned=2000;d.eco.house.sinceNpc=9999;d.eco.timer=99;d.advance(.2)'); await pg.wait_for_timeout(1500)
        print('npcs',await D('return d.eco.house.npcs.length+" index "+d.eco.house.index.toFixed(2)'))
        await D('d.advance(25)')
        # hotbar shows only what you own; jump and sprint toggle
        print('slots',await pg.evaluate("[...document.querySelectorAll('#bar .slot')].map(e=>e.textContent).join(' | ')"))
        await D('d.eco.tools.rod=true;d.advance(.1)'); await pg.wait_for_timeout(300)
        print('slots with rod',await pg.evaluate("[...document.querySelectorAll('#bar .slot')].map(e=>e.textContent).join(' | ')"))
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(250)
        print('jumped',await D('return d.player.jy>0||d.player.vy>0'))
        await pg.keyboard.press('ShiftLeft'); await pg.keyboard.up('ShiftLeft')
        print('sprint toggled',await D('return d.player.sprint'))
        # punch a neighbour
        await D('''const n=[...d.town.npcViews.values()][0];if(n){n.mesh.position.set(d.player.x,n.mesh.position.y,d.player.z-1.4);n.target=null;n.wait=5}d.player.yaw=0;d.player.pitch=0;d.advance(.1)''')
        await pg.keyboard.press('Digit3'); await D('d.advance(.1)')
        print('tool',await D('return d.jobs.tool'))
        await pg.mouse.click(450,250); await pg.wait_for_timeout(700); await D('d.advance(.3)')
        print('npc stunned',await D('const n=[...d.town.npcViews.values()][0];return n?n.stun:null'))
        await D('''const n=d.eco.house.npcs[0];if(n){const p=d.town.plots[n.plot];d.player.x=p.x+4;d.player.z=p.z+16;d.player.y=p.y+1.7;d.player.yaw=0;d.player.pitch=-.1;d.advance(.3)}''')
        await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/g4.png',timeout=180000)
        print('errs',errs)
        await b.close()
asyncio.run(main())
