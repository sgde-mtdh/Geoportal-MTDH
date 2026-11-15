'use strict';
const $=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat('es-EC',{maximumFractionDigits:2}).format(n);
const colors={inundaciones:{ALTA:'#d32f2f',MEDIA:'#ffc02e',BAJA:'#2e7d32'},movimientos:{'Muy alta':'#8b1e3f',Alta:'#d32f2f',Media:'#ffc02e'}};
const state={threat:'inundaciones',province:'',canton:'',parish:'',category:'',admin:null,stats:[],bounds:{},geos:{},mapLayer:null,outline:null,token:0};
const map=L.map('map',{preferCanvas:true,zoomControl:false}).setView([-1.9,-78.5],7);L.control.zoom({position:'bottomleft'}).addTo(map);L.control.scale({position:'bottomleft',metric:true,imperial:false,maxWidth:120}).addTo(map);
const bases={light:L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}),terrain:L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{attribution:'© OpenTopoMap',maxZoom:17}),satellite:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'© Esri',maxZoom:18})};let base=bases.light.addTo(map);
async function getJSON(path){const r=await fetch(path);if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);return r.json()}
function options(id,items,placeholder){const select=$(id);select.replaceChildren(new Option(placeholder,''));items.sort((a,b)=>a.name.localeCompare(b.name,'es')).forEach(x=>select.add(new Option(x.name,x.id)));select.disabled=id!=='province'&&items.length===0;}
function updateSelectors(){const a=state.admin;options('province',a.provincias,'Todas las provincias');options('canton',a.cantones.filter(x=>x.province===state.province),'Todos los cantones');options('parish',a.parroquias.filter(x=>x.canton===state.canton),'Todas las parroquias');$('province').value=state.province;$('canton').value=state.canton;$('parish').value=state.parish;}
function categorySelect(){const cats=colors[state.threat];$('category').replaceChildren(new Option('Todos los niveles',''));Object.keys(cats).forEach(c=>$('category').add(new Option(c,c)));$('category').value=state.category;$('legend-items').innerHTML=Object.entries(cats).map(([c,color])=>`<div class="legend-item"><span class="swatch" style="background:${color}"></span>${c}</div>`).join('');}
function selectedRows(){return state.stats.filter(r=>r.amenaza===state.threat&&(!state.province||r.parroquia.startsWith(state.province))&&(!state.canton||r.parroquia.startsWith(state.canton))&&(!state.parish||r.parroquia===state.parish)&&(!state.category||r.categoria===state.category));}
const originalMM={'Muy alta':20673.373536,Alta:41544.803412,Media:57050.430297};
const originalMMProvincia={
"01":[1584.86,2517.50,2186.93],"02":[556.50,1216.71,1130.12],"03":[710.20,919.66,853.40],"04":[732.91,1154.28,961.70],
"05":[1083.56,1713.98,1495.04],"06":[882.22,1829.24,1682.27],"07":[958.62,1282.92,870.19],"08":[906.37,759.05,989.19],
"09":[198.28,813.29,3339.48],"10":[941.69,1676.91,1119.87],"11":[2268.13,3792.67,2649.05],"12":[147.87,748.78,1883.29],
"13":[1123.94,987.28,1416.91],"14":[299.05,4593.95,8551.44],"15":[534.08,3443.52,5405.73],"16":[1435.94,2637.21,6074.26],
"17":[1577.98,3029.40,2666.93],"18":[429.11,1136.01,917.32],"19":[1765.38,3125.61,2624.71],"20":[0,0,0],
"21":[1450.38,1372.35,1156.28],"22":[575.10,1849.78,7134.38],"23":[173.53,586.33,1647.88],"24":[167.64,79.15,179.15]
};
function updateKpis(){$('k-total-label').textContent='Superficie susceptible a '+(state.threat==='inundaciones'?'inundaciones':'movimientos en masa');const rows=selectedRows().filter(r=>!['SIN','NO APLICABLE'].includes(r.categoria)),sum=fn=>rows.filter(fn).reduce((s,r)=>s+r.area_km2,0);let total=sum(r=>state.category||!['SIN','NO APLICABLE'].includes(r.categoria)),hi=sum(r=>['ALTA','Alta','Muy alta'].includes(r.categoria)),med=sum(r=>['MEDIA','Media'].includes(r.categoria));const nationalOriginal=state.threat==='movimientos'&&!state.province&&!state.canton&&!state.parish;if(nationalOriginal){total=state.category?(originalMM[state.category]||0):Object.values(originalMM).reduce((a,b)=>a+b,0);hi=!state.category||['Alta','Muy alta'].includes(state.category)?(state.category?originalMM[state.category]:originalMM.Alta+originalMM['Muy alta']):0;med=!state.category||state.category==='Media'?originalMM.Media:0;}const provincialOriginal=state.threat==='movimientos'&&!!state.province&&!state.canton&&!state.parish&&!!originalMMProvincia[state.province];if(provincialOriginal){const [muyAlta,alta,media]=originalMMProvincia[state.province];const v={'Muy alta':muyAlta,Alta:alta,Media:media};total=state.category?v[state.category]||0:muyAlta+alta+media;hi=state.category?(state.category==='Media'?0:v[state.category]||0):muyAlta+alta;med=state.category?(state.category==='Media'?media:0):media;}$('k-total').textContent=fmt(total);$('k-total-label').textContent=(nationalOriginal?'Superficie nacional de referencia SNGR · ':provincialOriginal?'Superficie provincial calculada sobre geometrías SNGR · ':'Superficie estimada · ')+(state.threat==='inundaciones'?'inundaciones':'movimientos en masa');$('k-high').textContent=fmt(hi);$('k-medium').textContent=fmt(med);$('k-parishes').textContent=new Set(rows.filter(r=>r.area_km2>0&&state.admin.parroquias.some(p=>p.id===r.parroquia)).map(r=>r.parroquia)).size.toLocaleString('es-EC');const list=state.admin;const title=state.parish?list.parroquias.find(x=>x.id===state.parish)?.name:state.canton?list.cantones.find(x=>x.id===state.canton)?.name:state.province?list.provincias.find(x=>x.id===state.province)?.name:'Ecuador';$('territory-title').textContent=title+(state.category?' · '+state.category:'');$('detail').textContent=provincialOriginal&&state.province==='20'?`La cartografía original de movimientos en masa recibida no contiene polígonos para Galápagos. Esto no equivale a ausencia de amenaza.`:provincialOriginal?`Superficie provincial calculada mediante intersección de los polígonos originales SNGR con el límite provincial del visualizador, en EPSG:32717. Puede diferir del total nacional por geometrías no asignadas a límites provinciales o discrepancias de límites. Las superficies cantonales y parroquiales siguen siendo estimaciones.`:nationalOriginal?`Superficies nacionales de referencia calculadas a partir del campo Shape_Area de la capa original SNGR (364.732 polígonos; EPSG:32717). La representación visual continúa siendo una versión generalizada y los resultados provinciales se calcularon por intersección con límites provinciales; los cantonales y parroquiales siguen siendo estimaciones.`:rows.length?`Selección: ${fmt(total)} km² sumados en ${rows.length} combinaciones de parroquia y categoría. La estimación utiliza celdas de 150 m y categorías mutuamente excluyentes por prioridad de amenaza. Las categorías técnicas SIN y NO APLICABLE no se contabilizan como superficie susceptible ni como parroquias.`:'No existen registros cartográficos para esta combinación. No significa que el territorio carezca de amenaza.';}
function outlineName(){return state.parish?'parroquias':state.canton?'cantones':'provincias'}
function outlineCode(){return state.parish||state.canton||state.province}
function drawOutline(zoom){if(state.outline)map.removeLayer(state.outline);const key=outlineName(),id=outlineCode(),features=state.bounds[key].features;const valid=features.filter(f=>['Polygon','MultiPolygon'].includes(f.geometry?.type));const show=id?valid.filter(f=>f.properties.id===id):valid;state.outline=L.geoJSON({type:'FeatureCollection',features:show},{style:{color:'#274c70',weight:id?2.2:1.05,fill:false,opacity:.85},onEachFeature:(f,l)=>{l.bindTooltip(f.properties.name);if(!id&&key==='provincias')l.on('click',()=>{state.province=f.properties.id;state.canton='';state.parish='';refresh(true)})}}).addTo(map);if(zoom&&state.outline.getLayers().length){const target=!id?L.latLngBounds([[-5.05,-81.05],[1.5,-75.05]]):state.outline.getBounds();map.fitBounds(target,{padding:[10,10],maxZoom:state.parish?13:state.canton?11:9});}}
function match(f){const p=f.properties;return (!state.province||p.province===state.province)&&(!state.canton||p.canton===state.canton)&&(!state.parish||p.parish===state.parish)&&(!state.category||p.categoria===state.category)}
async function drawThreat(){
 const token=++state.token;if(state.mapLayer){map.removeLayer(state.mapLayer);state.mapLayer=null}
 const th=state.threat;$('status').textContent='Cargando cartografía…';
 try{
  if(!state.province){
   const cats=state.category?[state.category]:Object.keys(colors[th]).reverse();
   const layers=cats.map(c=>L.imageOverlay('capas/'+th+'_overview_'+c.replaceAll(' ','_')+'.png',[[-5.4,-92.2],[2.0,-74.5]],{opacity:1,interactive:false}));
   if(token!==state.token)return;state.mapLayer=L.layerGroup(layers).addTo(map);
   $('status').textContent='Vista nacional · resolución cartográfica indicativa';
  }else{
   const key=th+'/'+state.province;if(!state.geos[key])state.geos[key]=await getJSON('capas/'+key+'.geojson');
   if(token!==state.token)return;
   const features=state.geos[key].features.filter(f=>['Polygon','MultiPolygon'].includes(f.geometry?.type)&&match(f)&&!['SIN','NO APLICABLE'].includes(f.properties.categoria));
   state.mapLayer=L.geoJSON({type:'FeatureCollection',features},{style:f=>({stroke:false,fillColor:colors[th][f.properties.categoria]||'#8795a5',fillOpacity:.68}),interactive:false}).addTo(map);
   $('status').textContent=features.length?features.length.toLocaleString('es-EC')+' polígonos visibles · detalle territorial':'Sin cobertura cartográfica para esta selección';
  }
  if(state.outline)state.outline.bringToFront();
 }catch(e){if(token===state.token)$('status').textContent='Error al cargar cartografía: '+e.message;console.error(e)}
}

const scenarioByProvince={
'01':[14210,1705,34],'02':[30993,1240,124],'03':[13136,1708,1281],'04':[7490,1124,337],
'05':[10508,315,13],'06':[17665,530,42],'07':[111343,22269,1781],'08':[38964,11689,2338],
'09':[611648,24466,3181],'10':[11326,906,18],'11':[97224,7778,389],'12':[175603,24584,246],
'13':[155543,32664,3266],'17':[39183,9404,188],'20':[2532,1722,172],
'23':[19154,1149,460],'24':[22707,2271,295]
};
const priorityProvinceSet=new Set(Object.keys(scenarioByProvince));
function updateImpact(){
 const mm=state.threat==='movimientos',province=state.province,record=province?scenarioByProvince[province]:[1379229,145523,14165];
 const show=v=>v==null?'Sin dato desagregado':Math.round(v).toLocaleString('es-EC');
 $('diag-exposed').textContent=show(record?.[0]);$('diag-damnified').textContent=show(record?.[1]);$('diag-shelter').textContent=show(record?.[2]);
 $('diag-priority').textContent=!province?'17 provincias':priorityProvinceSet.has(province)?'Incluida':'Sin dato en tabla 13';
 $('diag-priority-note').textContent=!province?'17 provincias incluidas en el escenario de población':state.canton||state.parish?'El estado específico del cantón o parroquia requiere verificar el Anexo 1; la inclusión provincial no confirma su priorización.':'Provincia incluida en el escenario preventivo de población';
 $('diag-warning').textContent=(state.canton||state.parish?'Sin desagregación cantonal o parroquial verificada: no se asignan cifras provinciales. ':'')+'Escenarios del Plan de Acción Nacional que integran ambas amenazas. No son afectaciones registradas.';
 if(state.canton||state.parish){['diag-exposed','diag-damnified','diag-shelter'].forEach(id=>$(id).textContent='Sin dato desagregado');}
 $('method-text').textContent=mm?'Movimientos en masa: la superficie nacional procede del campo Shape_Area de la cartografía original SNGR (364.732 polígonos, EPSG:32717). Las superficies provinciales se calcularon por intersección espacial. Las cifras cantonales y parroquiales son estimaciones de cuadrícula de 150 m; la representación es simplificada.':'Inundaciones: las superficies del visualizador son estimaciones cartográficas, no superficies oficiales. ALTA, MEDIA y BAJA son niveles de susceptibilidad, no eventos ocurridos. Los escenarios sectoriales proceden del Plan de Acción Nacional SNGR (2026).';
 $('k-high-label').textContent=mm?'Susceptibilidad alta y muy alta':'Susceptibilidad alta';
}
function refresh(zoom=false){updateImpact();updateSelectors();categorySelect();updateKpis();drawOutline(zoom);drawThreat()}
$('province').addEventListener('change',e=>{state.province=e.target.value;state.canton='';state.parish='';refresh(true)});
$('canton').addEventListener('change',e=>{state.canton=e.target.value;state.parish='';refresh(true)});
$('parish').addEventListener('change',e=>{state.parish=e.target.value;refresh(true)});
$('category').addEventListener('change',e=>{state.category=e.target.value;refresh(false)});
$('home').addEventListener('click',()=>{state.province='';state.canton='';state.parish='';state.category='';refresh(true)});
$('clear-filters').addEventListener('click',()=>{state.province='';state.canton='';state.parish='';state.category='';refresh(true)});
let printRestore=null;
function restoreMap(){if(!printRestore)return;const {parent,next}=printRestore;const mapbox=document.querySelector('#sheet-map-slot .mapbox');if(mapbox){if(next&&next.parentNode===parent)parent.insertBefore(mapbox,next);else parent.appendChild(mapbox)}printRestore=null;setTimeout(()=>{map.invalidateSize();drawOutline(false)},120)}
$('print-map').addEventListener('click',()=>{
 if(printRestore)return;
 const mapbox=document.querySelector('.layout .mapbox'),slot=$('sheet-map-slot');
 printRestore={parent:mapbox.parentNode,next:mapbox.nextSibling};
 $('sheet-title').textContent='Mapa de susceptibilidad a '+(state.threat==='inundaciones'?'inundaciones':'movimientos en masa');
 $('sheet-territory').textContent=$('territory-title').textContent;
 $('sheet-legend').innerHTML=$('legend-items').innerHTML;
 $('sheet-date').textContent='Elaboración: '+new Date().toLocaleDateString('es-EC');
 $('sheet-source').textContent='Fuente: SNGR · Cartografía de susceptibilidad · '+(state.threat==='movimientos'?'EPSG:32717 · visualización generalizada':'superficies indicativas')+' · límites administrativos 2024';
 slot.appendChild(mapbox);
 map.invalidateSize();
 setTimeout(()=>{map.invalidateSize();window.print()},500);
 setTimeout(restoreMap,4500);
});
window.addEventListener('afterprint',restoreMap);
$('basemap').addEventListener('change',e=>{map.removeLayer(base);base=bases[e.target.value].addTo(map);base.bringToBack()});
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{state.threat=b.dataset.threat;state.category='';document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));$('map-title').textContent='Susceptibilidad a '+(state.threat==='inundaciones'?'inundaciones':'movimientos en masa');refresh(false)}));
Promise.all([getJSON('capas/territorios.json'),getJSON('capas/superficies.json'),getJSON('capas/provincias.geojson'),getJSON('capas/cantones.geojson'),getJSON('capas/parroquias.geojson')]).then(([admin,stats,provinces,cantones,parroquias])=>{Object.assign(state,{admin,stats,bounds:{provincias:provinces,cantones,parroquias}});refresh(true)}).catch(e=>{$('status').textContent='Error al iniciar: '+e.message;console.error(e)});
