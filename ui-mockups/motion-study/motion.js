'use strict';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const panel = $('#demo-panel');
const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
const reduce = $('#reduce-motion');
reduce.checked = systemMotion.matches;
let concept = 0, selectedCar = null, workTab = 0, evidence = false, delivered = false;
let running = new Set(), transitionBusy = false, generation = 0;
const cars = [
  { name: 'Kia Sonet', year: '2021 · HTX Petrol', plate: 'TN 09 · 4821', image: 'sonet.jpg', state: 'Final checks', next: 'Finish the final inspection', note: '2 checks need attention before handover.' },
  { name: 'Kia Seltos', year: '2020 · HTX Diesel', plate: 'TN 10 · 3618', image: 'seltos.jpg', state: 'In service', next: 'Review the workshop update', note: 'Brake pads fitted. A road test is next.' },
];
const imageSources = { 'sonet.jpg': 'assets/sonet.jpg', 'seltos.jpg': 'assets/seltos.jpg' };
const copy = [
  ['Keep your place as you move from the garage into a car. The photo leads; the details follow.', '360 MS · OPEN / CLOSE', 'Open either car, then go back.'],
  ['Switch the work, keep the context. A sliding selector and a short directional transition make every tab feel connected.', '260 MS · TABS / 220 MS · EVIDENCE', 'Switch tabs. Add the sample photo.'],
  ['One light signature after a confirmed handover. A rare moment for the owner, with the record ready straight away.', '700 MS · ON CONFIRMED DELIVERY', 'Preview a confirmed delivery.'],
];
const lessMotion = () => reduce.checked || systemMotion.matches;
function announce(text) { $('#announcement').textContent = text; }
function animate(el, frames, options = {}) {
  if (!el || lessMotion()) return Promise.resolve();
  const a = el.animate(frames, { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)', ...options });
  running.add(a);
  return a.finished.catch(() => {}).finally(() => running.delete(a));
}
function cancelMotion() { for (const a of running) a.cancel(); running.clear(); $$('.floating-photo').forEach(e => e.remove()); transitionBusy = false; }
function applyMotionPreference() { cancelMotion(); if(systemMotion.matches)reduce.checked=true; document.body.classList.toggle('less-motion', lessMotion()); announce(lessMotion() ? 'Reduced motion enabled' : 'Full motion enabled'); }
reduce.addEventListener('change', applyMotionPreference);
systemMotion.addEventListener('change', () => { reduce.checked = systemMotion.matches; applyMotionPreference(); });
applyMotionPreference();
function garage() {
  panel.innerHTML = `<div class="scene"><p class="mini-eyebrow">OWNER / TODAY</p><h2>Your garage.</h2><p class="sub">Every car. Every next step.</p><div class="garage-summary"><div><b>12</b><span>In the garage</span></div><div><b>03</b><span>Need your call</span></div><div><b>02</b><span>Ready to go</span></div></div><div class="section-heading">Pick up where you left off<span>2 SAMPLE CARS</span></div><div class="car-grid">${cars.map((c,i)=>`<button class="car-card" data-car="${i}" aria-label="Open ${c.name}"><img src="${imageSources[c.image]}" alt="${c.name}"><span><strong>${c.name}</strong><small>${c.year}</small><span class="chip">${c.state}</span></span><b class="open-arrow" aria-hidden="true">↗</b></button>`).join('')}</div><span class="sample-label">Select a car to explore its workspace.</span></div>`;
  $$('[data-car]',panel).forEach(b=>b.addEventListener('click',()=>openCar(Number(b.dataset.car))));
}
function detail(i) {
  const c=cars[i];
  panel.innerHTML=`<div class="scene detail-scene"><button class="back" id="back-garage">← Back to garage</button><div class="hero"><img src="${imageSources[c.image]}" alt="${c.name}"><span class="chip">${c.state}</span></div><div class="detail-copy"><div class="car-title"><h2>${c.name}</h2><span class="mini-eyebrow">${i===0?'PETROL':'DIESEL'}</span></div><p class="numberplate">${c.plate} · ${c.year.split(' · ')[0]}</p><div class="next-action"><small>WHAT'S NEXT</small><h3>${c.next}</h3><p>${c.note}</p><button class="primary" id="try-work">Open work <span aria-hidden="true">↗</span></button></div></div></div>`;
  $('#back-garage').addEventListener('click',closeCar);
  $('#try-work').addEventListener('click',()=>chooseConcept(1,true));
}
async function flyPhoto(source, destination, revision) {
  if (lessMotion()) return;
  const a=source.rect, b=destination.getBoundingClientRect();
  const img=document.createElement('img');img.src=source.src;img.alt='';img.className='floating-photo';
  Object.assign(img.style,{left:b.left+'px',top:b.top+'px',width:b.width+'px',height:b.height+'px'});
  document.body.append(img);destination.style.visibility='hidden';
  await animate(img,[{left:a.left+'px',top:a.top+'px',width:a.width+'px',height:a.height+'px',borderRadius:'10px'},{left:b.left+'px',top:b.top+'px',width:b.width+'px',height:b.height+'px',borderRadius:'12px'}],{duration:360});
  img.remove();destination.style.visibility='';
  if(revision===generation)transitionBusy=false;
}
async function openCar(i) {
  if(transitionBusy)return;transitionBusy=true;const revision=++generation;
  const old=$(`[data-car="${i}"] img`);const source={src:old.src,rect:old.getBoundingClientRect()};
  selectedCar=i;detail(i);panel.scrollTop=0;
  const photo=$('.hero img');
  const flight=flyPhoto(source,photo,revision);
  animate($('.detail-copy'),[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,delay:lessMotion()?0:90});
  await flight;if(revision!==generation)return;transitionBusy=false;$('#back-garage')?.focus({preventScroll:true});announce(`${cars[i].name} workspace opened`);
}
async function closeCar() {
  if(transitionBusy)return;transitionBusy=true;const revision=++generation;const i=selectedCar;
  const old=$('.hero img');const source={src:old.src,rect:old.getBoundingClientRect()};selectedCar=null;garage();panel.scrollTop=0;
  await flyPhoto(source,$(`[data-car="${i}"] img`),revision);if(revision!==generation)return;transitionBusy=false;
  $(`[data-car="${i}"]`)?.focus({preventScroll:true});announce('Back to garage');
}
function work() {
  panel.innerHTML=`<div class="scene"><div class="work-car"><img src="assets/sonet.jpg" alt="Kia Sonet"><div><p class="mini-eyebrow">CAR WORKSPACE</p><h2>Kia Sonet</h2><p>2021 · HTX Petrol · TN 09 4821</p></div></div><div class="work-tabs" role="tablist" aria-label="Car work" style="--tab:${workTab}">${['Inspection','Repairs','Handover'].map((s,i)=>`<button id="work-tab-${i}" role="tab" data-work="${i}" aria-controls="work-pane" aria-selected="${workTab===i}" tabindex="${workTab===i?0:-1}">${s}</button>`).join('')}</div><div class="work-pane" id="work-pane" role="tabpanel" aria-labelledby="work-tab-${workTab}"></div></div>`;
  $$('[data-work]').forEach(b=>b.addEventListener('click',()=>changeWork(Number(b.dataset.work))));
  $('.work-tabs').addEventListener('keydown',e=>tabKeys(e,$$('[data-work]'),workTab,i=>changeWork(i)));
  workContent();
}
function workContent() {
  const pane=$('#work-pane');pane.setAttribute('aria-labelledby',`work-tab-${workTab}`);
  if(workTab===0){
    pane.innerHTML=`<h3>Lights & visibility</h3><p class="completed-summary"><span>✓ Headlights</span><span>✓ Indicators</span><small>2 passed</small></p><div class="check-row"><span>Rear lights<small>${evidence?'Sample photo added · result needed':'Add a photo to continue'}</small></span><span class="check-icon">${evidence?'▣':'3'}</span></div><button class="attach" id="sample-photo">${evidence?'<span class="evidence-thumb"><img src="assets/sonet.jpg" alt="Sample car photo"></span>':'<span class="camera-icon" aria-hidden="true">▣</span>'}<span><b>${evidence?'Photo attached':'Add sample photo'}</b><small>${evidence?'Demo evidence · tap to replay':'Try the evidence feedback'}</small></span></button><div class="progress-track"><span style="width:${evidence?'100':'67'}%"></span></div><p class="work-caption">${evidence?'3 of 3 photos attached. An employee still chooses the inspection result.':'2 of 3 photos attached. Tabs retain this work when you switch away.'}</p>`;
    $('#sample-photo').addEventListener('click',async()=>{evidence=true;workContent();await animate($('.evidence-thumb'),[{opacity:.2,transform:'scale(.86)'},{opacity:1,transform:'scale(1)'}],{duration:220});$('.evidence-thumb')?.classList.add('focus');$('#sample-photo')?.focus({preventScroll:true});announce('Sample photo attached. Inspection result still requires an employee.');});
  } else if(workTab===1) {
    pane.innerHTML=`<p class="mini-eyebrow">WORKSHOP / 2 JOBS</p><h3>Ready for the road.</h3><p class="sub">Updates from the workshop, in one place.</p><div class="check-row"><span>Front brake pads<small>Fitted · workshop photo received</small></span><span class="check-icon good">✓</span></div><div class="check-row"><span>Road test<small>Assigned to Ravi · next</small></span><span class="chip">Pending</span></div><p class="cost">₹4,800<small>Approved estimate</small></p><p class="work-caption">Sample workshop record. No approvals are made here.</p>`;
  } else {
    pane.innerHTML=`<p class="mini-eyebrow">DELIVERY / PREPARATION</p><h3>A confident handover.</h3><p class="sub">The essentials before the keys change hands.</p><div class="check-row"><span>Documents<small>Sample record verified</small></span><span class="check-icon good">✓</span></div><div class="check-row"><span>Final inspection<small>Waiting for employee sign-off</small></span><span class="chip">Pending</span></div><div class="check-row"><span>Warranty explained<small>Customer acknowledgement needed</small></span><span class="chip">Pending</span></div><button class="secondary" id="see-signature">See delivery motion →</button><span class="sample-label">Opens a separate completed-delivery sample.</span>`;
    $('#see-signature').addEventListener('click',()=>chooseConcept(2,true));
  }
}
function changeWork(i) {
  if(i===workTab)return;const direction=i>workTab?1:-1;workTab=i;
  for(const a of running)a.cancel();
  $('.work-tabs').style.setProperty('--tab',i);
  $$('[data-work]').forEach(b=>{const active=Number(b.dataset.work)===i;b.setAttribute('aria-selected',active);b.tabIndex=active?0:-1;});
  workContent();
  animate($('#work-pane'),[{opacity:.15,transform:`translateX(${direction*14}px)`},{opacity:1,transform:'translateX(0)'}],{duration:200});
  announce(['Inspection','Repairs','Handover'][i]+' selected');
}
const signature=`<svg class="signature" viewBox="0 0 300 70" aria-hidden="true"><path d="M4 32 H62 L78 42 H112 M188 42 H222 L238 32 H296"/><path d="M11 40 H57 L73 50 H109 M191 50 H227 L243 40 H289" opacity=".4"/></svg><div class="delivery-emblem"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m15 15 12 12m-4-4 3-3m-7-1 3-3"/></svg></div>`;
function delivery() {
  panel.innerHTML=`<div class="scene delivery-scene ${delivered?'confirmed':''}"><p class="mini-eyebrow">${delivered?'HANDOVER COMPLETE':'OWNER / A SIGNATURE MOMENT'}</p><div class="delivery-art ${delivered?'confirmed':''}">${signature}</div><h2>${delivered?'A new journey<br>begins.':'The keys.<br>The next chapter.'}</h2><p class="sub">${delivered?'Another car cared for. Another customer on the road.':'A small moment of pride, once the handover is confirmed.'}</p><div class="delivery-record"><img src="assets/sonet.jpg" alt="Kia Sonet"><span><strong>Kia Sonet</strong><small>${delivered?'Delivered · sample record':'2021 · HTX Petrol'}</small></span></div>${delivered?'<p class="confirmed-mark"><i>✓</i> Delivery recorded · demo</p><button class="secondary" id="replay-delivery">Replay the moment ↻</button>':'<button class="primary" id="preview-delivery">Preview confirmed delivery <span aria-hidden="true">↗</span></button>'}<span class="sample-label">${delivered?'The record is usable during the animation.':'A visual preview. No actual delivery is recorded.'}</span></div>`;
  $(delivered?'#replay-delivery':'#preview-delivery').addEventListener('click',confirmDelivery);
}
function confirmDelivery() {
  cancelMotion();delivered=true;delivery();
  const paths=$$('.signature path');
  paths.forEach(p=>{const length=p.getTotalLength();animate(p,[{strokeDasharray:length,strokeDashoffset:length,opacity:0},{strokeDasharray:length,strokeDashoffset:0,opacity:1}],{duration:700});});
  animate($('.delivery-emblem'),[{opacity:.2,transform:'scale(.85)'},{opacity:1,transform:'scale(1)'}],{duration:420});
  animate($('.delivery-scene h2'),[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:300});
  $('#replay-delivery').focus({preventScroll:true});announce('Completed-delivery motion preview. No actual record was changed.');
}
function chooseConcept(i,focus=false) {
  cancelMotion();++generation;concept=i;selectedCar=null;
  $$('.concept').forEach(b=>{const active=Number(b.dataset.concept)===i;b.classList.toggle('active',active);b.setAttribute('aria-selected',active);b.tabIndex=active?0:-1;});
  panel.setAttribute('aria-labelledby',`concept-${i}`);panel.scrollTop=0;
  $('#concept-purpose').textContent=copy[i][0];$('#timing').textContent=copy[i][1];$('#try-instruction').innerHTML=`TRY IT <span>${copy[i][2]}</span>`;
  [garage,work,delivery][i]();
  if(focus)$('#concept-'+i).focus({preventScroll:true});
}
function tabKeys(e,buttons,index,choose) {
  let next=index;
  if(e.key==='ArrowRight')next=(index+1)%buttons.length;
  else if(e.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;
  else if(e.key==='Home')next=0;
  else if(e.key==='End')next=buttons.length-1;
  else return;
  e.preventDefault();choose(next);buttons[next].focus({preventScroll:true});
}
$$('.concept').forEach(b=>b.addEventListener('click',()=>chooseConcept(Number(b.dataset.concept))));
$('.concepts').addEventListener('keydown',e=>tabKeys(e,$$('.concept'),concept,chooseConcept));
$('#reset').addEventListener('click',()=>{workTab=0;evidence=false;delivered=false;chooseConcept(concept);announce('Demo reset');});
$$('[data-device]').forEach(b=>b.addEventListener('click',()=>{
  cancelMotion();if(concept===0&&selectedCar!==null){const i=selectedCar;detail(i);}
  $('#device').classList.toggle('tablet',b.dataset.device==='tablet');
  $$('[data-device]').forEach(x=>x.setAttribute('aria-pressed',x===b));
}));
addEventListener('resize',()=>{cancelMotion();});
addEventListener('keydown',e=>{if(e.key==='Escape'&&concept===0&&selectedCar!==null)closeCar();});
chooseConcept(0);
