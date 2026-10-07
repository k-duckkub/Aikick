"""Bake decorative textures once. Run the dev server before running this script."""
import base64
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'superdev/assets/img/motion'
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
        args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width':1600, 'height':1000})
    page.route('**/superdev/?bake', lambda route: route.fulfill(status=200,content_type='text/html',
        body='<html><head><link rel="stylesheet" href="assets/styles.css"></head><body><div></div></body></html>'))
    page.goto('http://127.0.0.1:4321/superdev/?bake', wait_until='networkidle')
    data = page.evaluate('''async () => {
      const {initBg3d} = await import('/tools/bake-bg-scene.mjs');
      const {T,renderer,scene,meta} = await initBg3d();
      const main = meta.groups.filter(g => !['rock','star','train-loco','train-car'].includes(g.kind));
      const groups = scene.children.filter(g => g.isGroup);
      const bakeScene = new T.Scene();
      for (const light of scene.children.filter(g => g.isLight)) bakeScene.add(light.clone());
      const cam = new T.PerspectiveCamera(40, 1, .1, 150);
      renderer.setPixelRatio(1);
      const items = [];
      const bake = (group, info, i, pixels) => {
        group.updateMatrixWorld(true);
        const box = new T.Box3().setFromObject(group);
        const center = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3());
        const span = Math.max(size.x,size.y) * 1.12 + size.z * .12;
        const copy = group.clone(true);
        copy.position.sub(center);
        bakeScene.add(copy);
        cam.position.set(0,0,span / (2*Math.tan(Math.PI/9)) + size.z/2);
        cam.lookAt(0,0,0);
        renderer.setSize(pixels,pixels,false);
        renderer.render(bakeScene,cam);
        const canvas=document.createElement('canvas');canvas.width=canvas.height=pixels;
        const ctx=canvas.getContext('2d');ctx.drawImage(renderer.domElement,0,0);
        const rgba=ctx.getImageData(0,0,pixels,pixels).data;
        let left=pixels,top=pixels,right=0,bottom=0;
        for(let y=0;y<pixels;y++)for(let x=0;x<pixels;x++)if(rgba[(y*pixels+x)*4+3]){
          left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
        }
        if(left===pixels)throw new Error(`Empty texture: ${info.kind}-${i}`);
        left=Math.max(0,left-2);top=Math.max(0,top-2);right=Math.min(pixels-1,right+2);bottom=Math.min(pixels-1,bottom+2);
        const w=right-left+1,h=bottom-top+1,cropped=document.createElement('canvas');
        cropped.width=w;cropped.height=h;cropped.getContext('2d').drawImage(canvas,left,top,w,h,0,0,w,h);
        const file = `${info.kind}-${i}.webp`;
        items.push({file, kind:info.kind, center:center.toArray(), span, bob:info.bob || 0,
          width:span*w/pixels,height:span*h/pixels,offset:[span*((left+right+1)/2-pixels/2)/pixels,span*((top+bottom+1)/2-pixels/2)/pixels],
          pixelWidth:w,pixelHeight:h,image:cropped.toDataURL('image/webp',.88)});
        bakeScene.remove(copy);
      };
      main.forEach((info,i) => bake(groups[i],info,i,512));
      const debris = groups[groups.length-1], source = debris.children[0].geometry;
      let vertex=0,index=0;
      const loose = meta.groups.filter(g => ['rock','star'].includes(g.kind));
      for (const [i,info] of loose.entries()) {
        const nv=info.parts.reduce((n,p)=>n+p.n,0), ni=info.parts.reduce((n,p)=>n+p.i,0);
        const geometry=new T.BufferGeometry();
        for (const name of ['position','normal','hn','color','emi']) {
          const attr=source.getAttribute(name), n=attr.itemSize;
          geometry.setAttribute(name,new T.BufferAttribute(attr.array.slice(vertex*n,(vertex+nv)*n),n));
        }
        geometry.setIndex(new T.BufferAttribute(source.index.array.slice(index,index+ni).map(v=>v-vertex),1));
        const group=new T.Group();
        debris.children.forEach(mesh => group.add(new T.Mesh(geometry,mesh.material)));
        bake(group,info,main.length+i,96);
        geometry.dispose();
        vertex+=nv;index+=ni;
      }
      renderer.dispose();
      return {col:meta.col,items};
    }''')
    for item in data['items']:
        (OUT/item['file']).write_bytes(base64.b64decode(item.pop('image').split(',',1)[1]))
    (ROOT/'superdev/assets/3d/background-sprites.js').write_text('export default '+json.dumps(data,separators=(',',':'))+';\n')
    print(f"Baked {len(data['items'])} background textures.",flush=True)
    textures = page.evaluate('''async () => {
      const {galaxy,blackHole}=await import('/superdev/assets/cosmos.js');
      const result=[];
      for (const [file,svg,w,h] of [['galaxy-59.webp',galaxy(59),800,800],['galaxy-52.webp',galaxy(52),800,800],['black-hole.webp',blackHole('baked'),900,600]]) {
        const img=new Image();
        const url=URL.createObjectURL(new Blob([svg.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ')],{type:'image/svg+xml'}));
        img.src=url;await img.decode();
        const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
        const ctx=canvas.getContext('2d');ctx.filter='saturate(.5) brightness(.8)';ctx.drawImage(img,0,0,w,h);
        result.push({file,image:canvas.toDataURL('image/webp',.9)});URL.revokeObjectURL(url);
      }
      return result;
    }''')
    for item in textures:
        (OUT/item['file']).write_bytes(base64.b64decode(item['image'].split(',',1)[1]))
    browser.close()
print('Baked galaxy and black hole textures.')
