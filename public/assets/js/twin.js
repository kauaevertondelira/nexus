import * as THREE from '../vendor/three/three.module.min.js';

const colors={online:0xe7f14a,danger:0xff816b,offline:0x7e8976};
function box(w,h,d,mat,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);return m;}
function cylinder(radius,length,material,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,40),material);m.rotation.z=Math.PI/2;m.position.set(x,y,z);return m;}
function motorModel(scale=1){
  const group=new THREE.Group(),body=new THREE.MeshStandardMaterial({color:0x687380,metalness:.82,roughness:.3}),edges=new THREE.MeshStandardMaterial({color:0x303640,metalness:.7,roughness:.32}),shaft=new THREE.MeshStandardMaterial({color:0xd7d9d5,metalness:.9,roughness:.21}),blue=new THREE.MeshStandardMaterial({color:0x173acf,metalness:.5,roughness:.32});
  group.add(cylinder(.68,2.7,body,0,.95),cylinder(.73,.18,edges,-1.4,.95),cylinder(.69,.2,edges,1.4,.95));
  const rotor=new THREE.Group();rotor.name='rotor';rotor.position.set(1.9,.95,0);rotor.add(cylinder(.16,1.1,shaft),box(.72,.06,.07,edges,0,0,.16));group.add(rotor);
  for(let i=0;i<18;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.71,.023,5,40),body);ring.rotation.y=Math.PI/2;ring.position.set(-1.15+i*.135,.95,0);group.add(ring);}
  group.add(box(1,.32,.95,blue,.1,1.78,0),box(.6,.13,1.2,body,-.7,.18,0),box(.6,.13,1.2,body,.7,.18,0));
  for(const x of [-.7,.7])for(const z of [-.5,.5]){const bolt=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.12,6),shaft);bolt.position.set(x,.28,z);group.add(bolt);}
  group.scale.setScalar(scale);return group;
}
function rendererFor(container,transparent=false){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:transparent,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(max-width: 780px)').matches?1.25:1.75));renderer.setClearColor(transparent?0x204cff:0x202322,transparent?0:1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;container.append(renderer.domElement);
  const resize=callback=>{const obs=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);callback(w,h);});obs.observe(container);return obs;};
  return {renderer,resize};
}
function dispose(scene,renderer){scene.traverse(o=>{o.geometry?.dispose();if(o.material){const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>{m.map?.dispose();m.dispose();});}});renderer.dispose();renderer.domElement.remove();}
export function createMotor(container,{reduced=false}={}){
  const {renderer,resize}=rendererFor(container,true),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,100);camera.position.set(5.3,3.8,6.5);camera.lookAt(0,.9,0);
  const model=motorModel();model.rotation.y=-.15;scene.add(model);scene.add(new THREE.HemisphereLight(0xffffff,0x204cff,3));const key=new THREE.DirectionalLight(0xffffff,4);key.position.set(3,6,5);scene.add(key);const rim=new THREE.DirectionalLight(0xe7f14a,3);rim.position.set(-4,2,-4);scene.add(rim);
  let frame,last=0,elapsed=0,visible=true,progress=.5,disposed=false;const pointer={x:0,y:0},rotor=model.getObjectByName('rotor');
  const move=event=>{const rect=container.getBoundingClientRect();pointer.x=(event.clientX-rect.left)/rect.width-.5;pointer.y=(event.clientY-rect.top)/rect.height-.5;};
  const leave=()=>{pointer.x=0;pointer.y=0;};
  if(!reduced){container.addEventListener('pointermove',move);container.addEventListener('pointerleave',leave);}
  const draw=time=>{if(disposed)return;if(!reduced)frame=requestAnimationFrame(draw);if(!visible||document.hidden){last=time;return;}if(time-last<16)return;const delta=Math.min((time-last)/1000,.05);last=time;if(!reduced){elapsed+=delta;model.rotation.y=-.15+elapsed*.38+pointer.x*.35+(progress-.5)*.7;model.rotation.x+=(pointer.y*.16-model.rotation.x)*.08;model.position.y=Math.sin(elapsed*1.3)*.075;if(rotor)rotor.rotation.x=elapsed*8;}renderer.render(scene,camera);};
  const obs=resize((w,h)=>{camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);});const vis=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});vis.observe(container);frame=requestAnimationFrame(draw);document.querySelector('.schematic-fallback')?.setAttribute('hidden','');
  return {setProgress(value){progress=value;},dispose(){disposed=true;cancelAnimationFrame(frame);obs.disconnect();vis.disconnect();container.removeEventListener('pointermove',move);container.removeEventListener('pointerleave',leave);dispose(scene,renderer);}};
}
function label(text){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const context=canvas.getContext('2d');context.fillStyle='#202322cc';context.fillRect(0,0,256,64);context.textAlign='center';context.textBaseline='middle';context.font='500 30px Arial';context.fillStyle='#e7ecdf';context.fillText(String(text).slice(0,18),128,32);const texture=new THREE.CanvasTexture(canvas);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));sprite.scale.set(2.3,.575,1);return sprite;}
export function createFactory(container,assets,onSelect){
  const {renderer,resize}=rendererFor(container),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,200),groups=new Map();
  scene.add(new THREE.HemisphereLight(0xffffff,0x373f32,2.5));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(6,15,8);scene.add(light);
  const grid=new THREE.GridHelper(30,30,0x5b654f,0x30392c);scene.add(grid);
  let radius=22,theta=.7,phi=.85,last=0,drag=null,moved=0,frame,disposed=false;
  const updateCamera=()=>{camera.position.set(radius*Math.sin(phi)*Math.sin(theta),radius*Math.cos(phi),radius*Math.sin(phi)*Math.cos(theta));camera.lookAt(0,0,0);};updateCamera();
  const baseMat=new THREE.MeshStandardMaterial({color:0x47503e,metalness:.15,roughness:.8});
  const createAsset=(a,index)=>{
    const group=new THREE.Group(),color=colors[a.status]||colors.offline,material=new THREE.MeshStandardMaterial({color,metalness:.3,roughness:.45}),steel=new THREE.MeshStandardMaterial({color:0xa5ae9d,metalness:.6,roughness:.35});
    group.add(box(2.5,.18,2.4,baseMat,0,.1),box(2.3,.035,.16,material,0,.215,1.02));
    const name=(a.assetClass||a.name||'').toLowerCase();
    if(name.includes('compressor')||name.includes('bomba')){const model=motorModel(.68);model.position.y=.15;group.add(model);}
    else if(name.includes('prensa')){group.add(box(1.65,.3,1.7,material,0,2.7),box(1.5,.35,1.6,steel,0,1.45));for(const x of[-.8,.8])for(const z of[-.6,.6])group.add(box(.16,2.4,.16,steel,x,1.4,z));}
    else if(name.includes('robô')||name.includes('robot')){group.add(box(.8,.7,.8,material,0,.55));const arm=box(.28,1.8,.28,material,0,1.6);arm.rotation.z=.5;group.add(arm);const forearm=box(1.35,.24,.24,steel,-.7,2.25);forearm.rotation.z=-.35;group.add(forearm,box(.2,.4,.3,material,-1.3,1.98));}
    else if(name.includes('esteira')||name.includes('transport')){group.add(box(2.6,.18,.9,material,0,.9));for(const x of[-1.05,1.05])for(const z of[-.35,.35])group.add(box(.12,.8,.12,steel,x,.55,z));for(let i=0;i<7;i++)group.add(box(.05,.04,.9,steel,-1.15+i*.38,1.01));}
    else{group.add(box(1.95,1.65,1.7,material,0,1),box(1.35,.7,.04,new THREE.MeshStandardMaterial({color:0x1c251b,roughness:.7}),0,1.3,.87),box(.5,.6,.16,steel,1.1,1.4,.7));}
    const tag=label(a.tag||a.id);tag.position.set(0,.4,1.9);group.add(tag);
    const columns=4;group.position.set((index%columns-1.5)*4.2,0,(Math.floor(index/columns)-Math.floor((assets.length-1)/columns)/2)*4.6);group.userData.assetId=a.id;
    group.traverse(mesh=>{mesh.userData.assetId=a.id;});scene.add(group);groups.set(a.id,{group,material,status:a.status});
  };
  assets.forEach(createAsset);
  const pointerDown=event=>{drag={x:event.clientX,y:event.clientY};moved=0;container.setPointerCapture?.(event.pointerId);};
  const pointerMove=event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;moved+=Math.abs(dx)+Math.abs(dy);theta-=dx*.005;phi=Math.max(.22,Math.min(1.4,phi+dy*.003));drag={x:event.clientX,y:event.clientY};updateCamera();};
  const pointerUp=event=>{if(drag&&moved<8){const rect=renderer.domElement.getBoundingClientRect(),point=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),ray=new THREE.Raycaster();ray.setFromCamera(point,camera);const hits=ray.intersectObjects([...groups.values()].map(g=>g.group),true);if(hits[0]?.object.userData.assetId)onSelect(hits[0].object.userData.assetId);}drag=null;};
  const wheel=event=>{event.preventDefault();radius=Math.max(9,Math.min(45,radius+event.deltaY*.018));updateCamera();};
  const pointerCancel=()=>{drag=null;};container.addEventListener('pointerdown',pointerDown);container.addEventListener('pointermove',pointerMove);container.addEventListener('pointerup',pointerUp);container.addEventListener('pointercancel',pointerCancel);container.addEventListener('wheel',wheel,{passive:false});
  const obs=resize((w,h)=>{camera.aspect=w/h;camera.updateProjectionMatrix();});
  const draw=time=>{if(disposed)return;frame=requestAnimationFrame(draw);if(time-last<40)return;last=time;renderer.render(scene,camera);};frame=requestAnimationFrame(draw);
  return {
    reset(){radius=22;theta=.7;phi=.85;updateCamera();},
    select(id){groups.forEach((g,k)=>{g.group.position.y=k===id ? .18 : 0;g.material.emissive.setHex(k===id?0x263526:0);});},
    update(items){items.forEach(a=>{const g=groups.get(a.id);if(g&&a.status!==g.status){g.material.color.setHex(colors[a.status]||colors.offline);g.status=a.status;}});},
    dispose(){disposed=true;cancelAnimationFrame(frame);obs.disconnect();container.removeEventListener('pointerdown',pointerDown);container.removeEventListener('pointermove',pointerMove);container.removeEventListener('pointerup',pointerUp);container.removeEventListener('pointercancel',pointerCancel);container.removeEventListener('wheel',wheel);dispose(scene,renderer);}
  };
}
