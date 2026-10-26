import asyncio
exec(open('/tmp/game.py').read().split("async def main")[0])
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
        pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8767/world.html?fixed=1&lq=1')
        try: await pg.wait_for_function('window.__dev&&window.__frames>2',timeout=150000)
        except Exception as e: print('NOLOAD',errs); return
        D=lambda js: pg.evaluate('(()=>{const d=window.__dev;'+js+'})()')
        print(await D('return JSON.stringify(d.poi.list.map(p=>[p.name,Math.round(p.x),Math.round(p.z),Math.round(p.y)]))'))
        spots={'w1':'const L=d.poi.wreck;window.__cam=[L.x+Math.cos(.3)*14,4.5,L.z+Math.sin(.3)*14,L.x,1.5,L.z];',
          'w2':'const L=d.poi.wreck;window.__cam=[L.x+Math.cos(2.0)*13,4,L.z+Math.sin(2.0)*13,L.x,1.5,L.z];',
          'w3':'const L=d.poi.wreck;window.__cam=[L.x+Math.cos(4.2)*13,4,L.z+Math.sin(4.2)*13,L.x,1.5,L.z];',
          'c1':'const L=d.poi.list.find(p=>p.name==="Waterfall cave");const f=d.poi.blockers.find(b=>b.ring).ring.face;window.__cam=[L.x+Math.cos(f+.5)*17,L.y+4,L.z+Math.sin(f+.5)*17,L.x,L.y+2,L.z];',
          'c2':'const L=d.poi.list.find(p=>p.name==="Waterfall cave");const f=d.poi.blockers.find(b=>b.ring).ring.face;window.__cam=[L.x+Math.cos(f)*11,L.y+1.7,L.z+Math.sin(f)*11,L.x,L.y+1.5,L.z];',
          'c3':'const L=d.poi.list.find(p=>p.name==="Waterfall cave");const f=d.poi.blockers.find(b=>b.ring).ring.face;window.__cam=[L.x+Math.cos(f)*3,L.y+1.7,L.z+Math.sin(f)*3,L.x-Math.cos(f)*4,L.y+2.2,L.z-Math.sin(f)*4];',
          'c4':'const L=d.poi.list.find(p=>p.name==="Waterfall cave");const f=d.poi.blockers.find(b=>b.ring).ring.face;window.__cam=[L.x+Math.cos(f+3.14+.8)*24,L.y+5,L.z+Math.sin(f+3.14+.8)*24,L.x+Math.cos(f+3.14)*12,L.y+5,L.z+Math.sin(f+3.14)*12];'}
        for k,js in spots.items():
            await pg.evaluate('window.__fly=16');await D(js+'d.player.y+=16;d.advance(1.5)')
            await pg.wait_for_timeout(500)
            await D('d.advance(.5)')
            await pg.screenshot(path=f'/tmp/p_{k}.png',timeout=180000)
        print(errs)
        await b.close()
asyncio.run(main())
