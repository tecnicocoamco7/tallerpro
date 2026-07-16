import { useState, useEffect, useRef, createContext, useContext } from "react";
import { supabase, STATE_TABLE, STATE_ROW_ID } from "./supabaseClient";

const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);
const uid = () => Date.now() + Math.floor(Math.random() * 9999);
const fmt = (f) => f ? new Date(f).toLocaleDateString("es", { day:"2-digit", month:"short", year:"numeric" }) : "—";
const fmtDT = (f) => f ? new Date(f).toLocaleString("es", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
const diasDesde = (fecha) => Math.floor((Date.now() - new Date(fecha)) / 86400000);
const fonts = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');`;

const PRIORIDADES = [
  { id:"alta",  label:"Alta",  color:"#ef4444" },
  { id:"media", label:"Media", color:"#f59e0b" },
  { id:"baja",  label:"Baja",  color:"#22c55e" },
];
const ESTADOS_SEED = [
  { id:"operativo",           label:"Operativo",           color:"#22c55e" },
  { id:"inoperativo",         label:"Inoperativo",         color:"#ef4444" },
  { id:"esperando_repuestos", label:"Esperando repuestos", color:"#f59e0b" },
  { id:"fuera_servicio",      label:"Fuera de servicio",   color:"#dc2626" },
];
const TIPOS_EQUIPO_SEED = ["Batería","Cargador","Generador","Compresor","Montacargas","Excavadora","Grúa","Camión","Otro"];
const ROLES = { admin:"Administrador", tecnico:"Técnico" };

const S_USUARIOS = [
  { id:1, nombre:"Admin Principal", usuario:"admin",  password:"admin123",   rol:"admin",   activo:true },
  { id:2, nombre:"Técnico",         usuario:"carlos", password:"tecnico123", rol:"tecnico", activo:true },
];

// Sin datos de ejemplo — el usuario los llena
const S_CLIENTES = [];
const S_EQUIPOS  = [];
const S_OT       = [];
const S_LOG      = [];
const S_NOTIF    = {};
// Etiquetas de tipo de cliente editables
const S_ETIQUETAS_CLIENTE = ["Alquiler", "Cliente propio"];

// ── UI BASE ───────────────────────────────────────────────────────────────────
const iS = { background:"#070d1a", border:"1px solid #1e293b", borderRadius:8, color:"#e2e8f0", padding:"9px 12px", fontSize:13, fontFamily:"DM Sans,sans-serif", outline:"none", width:"100%", boxSizing:"border-box" };

function Badge({ color="#64748b", children, sm }) {
  return <span style={{ background:color+"22", color, border:`1px solid ${color}44`, borderRadius:20, padding:sm?"1px 8px":"3px 12px", fontSize:sm?10:11, fontWeight:700, whiteSpace:"nowrap", fontFamily:"DM Sans,sans-serif" }}>{children}</span>;
}
function Btn({ onClick, variant="primary", children, sm, full, disabled }) {
  const base = { cursor:disabled?"not-allowed":"pointer", border:"none", borderRadius:8, fontFamily:"DM Sans,sans-serif", fontWeight:600, transition:"all 0.15s", opacity:disabled?0.5:1, width:full?"100%":"auto" };
  const v = {
    primary:   { background:"#f97316", color:"#fff",        padding:sm?"5px 14px":"9px 20px", fontSize:sm?12:13 },
    secondary: { background:"transparent", color:"#94a3b8", border:"1px solid #1e293b",       padding:sm?"4px 12px":"8px 18px", fontSize:sm?12:13 },
    danger:    { background:"transparent", color:"#ef4444", border:"1px solid #ef444444",     padding:sm?"4px 12px":"8px 18px", fontSize:sm?12:13 },
    ghost:     { background:"transparent", color:"#64748b",                                   padding:sm?"4px 8px":"8px 12px",  fontSize:sm?12:13 },
    success:   { background:"#22c55e22",   color:"#22c55e", border:"1px solid #22c55e44",     padding:sm?"4px 12px":"8px 18px", fontSize:sm?12:13 },
  };
  return <button style={{...base,...v[variant]}} onClick={disabled?undefined:onClick}>{children}</button>;
}
function Card({ children, style, onClick }) {
  return <div onClick={onClick} style={{ background:"#0d1525", border:"1px solid #1e293b", borderRadius:14, padding:20, cursor:onClick?"pointer":"default", ...style }}>{children}</div>;
}
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"#000000cc", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:16 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:"#0d1525", border:"1px solid #1e293b", borderRadius:16, width:"100%", maxWidth:wide?720:500, maxHeight:"92vh", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 24px", borderBottom:"1px solid #1e293b" }}>
          <span style={{ fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:16, color:"#f1f5f9" }}>{title}</span>
          <Btn variant="ghost" sm onClick={onClose}>✕</Btn>
        </div>
        <div style={{ padding:24, overflowY:"auto" }}>{children}</div>
      </div>
    </div>
  );
}
function Field({ label, children, half, third }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5, flex:third?"1 1 calc(33% - 8px)":half?"1 1 calc(50% - 8px)":"1 1 100%" }}>
      <label style={{ fontSize:11, color:"#64748b", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", fontFamily:"DM Sans,sans-serif" }}>{label}</label>
      {children}
    </div>
  );
}
function Input({ value, onChange, type="text", placeholder, textarea, ...rest }) {
  return textarea
    ? <textarea style={{...iS,minHeight:80,resize:"vertical"}} value={value||""} onChange={onChange} placeholder={placeholder} {...rest}/>
    : <input style={iS} type={type} value={value||""} onChange={onChange} placeholder={placeholder} {...rest}/>;
}
function Sel({ value, onChange, options }) {
  return <select style={iS} value={value||""} onChange={onChange}>{options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>;
}
function PageHeader({ title, sub, onBack, action }) {
  return (
    <div style={{ marginBottom:24 }}>
      <button onClick={onBack} style={{ background:"none", border:"none", color:"#f97316", cursor:"pointer", fontFamily:"DM Sans,sans-serif", fontSize:12, fontWeight:600, marginBottom:12, padding:0 }}>← Dashboard</button>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <h1 style={{ fontFamily:"Syne,sans-serif", fontSize:22, fontWeight:800, color:"#f1f5f9", margin:0 }}>{title}</h1>
          {sub && <p style={{ fontFamily:"DM Sans,sans-serif", fontSize:13, color:"#64748b", margin:"4px 0 0" }}>{sub}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
function EmptyState({ msg }) {
  return <div style={{ textAlign:"center", color:"#475569", padding:"32px 20px", fontFamily:"DM Sans,sans-serif", fontSize:14 }}>{msg}</div>;
}
function SecLabel({ children, color }) {
  return <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:11, fontWeight:700, color:color||"#64748b", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>{children}</div>;
}
function Dot() {
  return <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:"#ef4444", flexShrink:0 }}/>;
}

// ── BUSCADOR EQUIPO ───────────────────────────────────────────────────────────
function BuscadorEquipo({ equipos, clientes, onSelect, selected }) {
  const [q, setQ] = useState("");
  const res = q.length > 1 ? equipos.filter(e =>
    e.serie?.toLowerCase().includes(q.toLowerCase()) ||
    e.marca?.toLowerCase().includes(q.toLowerCase()) ||
    e.modelo?.toLowerCase().includes(q.toLowerCase())
  ) : [];
  const sel = equipos.find(e=>e.id===selected);
  return (
    <div style={{ position:"relative" }}>
      <input style={iS} value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por serie, marca o modelo..."/>
      {sel && !q && <div style={{ marginTop:6, padding:"8px 12px", background:"#f9731622", border:"1px solid #f9731644", borderRadius:8, fontFamily:"DM Sans,sans-serif", fontSize:13, color:"#f97316", display:"flex", justifyContent:"space-between" }}>
        <span>✓ {sel.marca} {sel.modelo} — {sel.serie}</span>
        <button onClick={()=>onSelect(null)} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer" }}>✕</button>
      </div>}
      {res.length > 0 && q && <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:50, background:"#0d1525", border:"1px solid #1e293b", borderRadius:8, marginTop:4, maxHeight:200, overflowY:"auto" }}>
        {res.map(e=>{
          const cli=clientes.find(c=>c.id===e.clienteId);
          return <div key={e.id} onClick={()=>{onSelect(e.id);setQ("");}}
            style={{ padding:"10px 14px", cursor:"pointer", borderBottom:"1px solid #1e293b", fontFamily:"DM Sans,sans-serif" }}
            onMouseEnter={el=>el.currentTarget.style.background="#1e293b"} onMouseLeave={el=>el.currentTarget.style.background="transparent"}>
            <div style={{ fontWeight:600, color:"#f1f5f9", fontSize:13 }}>{e.marca} {e.modelo}</div>
            <div style={{ color:"#64748b", fontSize:11 }}>Serie: {e.serie} · {cli?.nombre}</div>
          </div>;
        })}
      </div>}
      {q.length>1&&res.length===0&&<div style={{ marginTop:6, padding:"8px 12px", background:"#070d1a", border:"1px solid #1e293b", borderRadius:8, fontFamily:"DM Sans,sans-serif", fontSize:12, color:"#64748b" }}>No se encontró ningún equipo.</div>}
    </div>
  );
}

// ── FORMULARIO OT ─────────────────────────────────────────────────────────────
function OTForm({ data, equipos, clientes, usuarios, onSave, onCancel }) {
  const [f, setF] = useState(data);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const tecnicos = usuarios.filter(u=>u.activo);
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:14 }}>
      <Field label="Título de la OT">
        <Input value={f.titulo} onChange={e=>set("titulo",e.target.value)} placeholder="Ej: Cliente reporta equipo apagado"/>
      </Field>
      <Field label="Equipo">
        <BuscadorEquipo equipos={equipos} clientes={clientes} selected={f.equipoId}
          onSelect={id=>{ set("equipoId",id); const eq=equipos.find(e=>e.id===id); if(eq) set("clienteId",eq.clienteId); }}/>
      </Field>
      <Field label="Cliente" half>
        <Sel value={f.clienteId||""} onChange={e=>set("clienteId",Number(e.target.value))} options={[{v:"",l:"— Seleccionar —"},...clientes.map(c=>({v:c.id,l:c.nombre}))]}/>
      </Field>
      <Field label="Técnico asignado" half>
        <Sel value={f.tecnicoId||""} onChange={e=>set("tecnicoId",Number(e.target.value))} options={[{v:"",l:"— Sin asignar —"},...tecnicos.map(u=>({v:u.id,l:`${u.nombre} (${ROLES[u.rol]})`}))]}/>
      </Field>
      <Field label="Prioridad" half>
        <Sel value={f.prioridad} onChange={e=>set("prioridad",e.target.value)} options={PRIORIDADES.map(p=>({v:p.id,l:p.label}))}/>
      </Field>
      <Field label="Descripción / detalles">
        <Input value={f.descripcion} onChange={e=>set("descripcion",e.target.value)} textarea placeholder="Describe detalladamente el trabajo a realizar, síntomas, observaciones..."/>
      </Field>
      <div style={{ display:"flex", gap:10, width:"100%", marginTop:4 }}>
        <Btn onClick={()=>{ if(!f.titulo.trim()){alert("Escribe un título.");return;} onSave(f); }}>Guardar OT</Btn>
        <Btn variant="secondary" onClick={onCancel}>Cancelar</Btn>
      </div>
    </div>
  );
}

// ── DETALLE OT ────────────────────────────────────────────────────────────────
function OTDetalle({ ot, onClose }) {
  const { equipos, clientes, usuarios, ordenesTrabajos, setOrdenesTrabajo, user, addLog, notificaciones, setNotificaciones } = useApp();
  const [editando,      setEditando]      = useState(false);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const esAdmin = user.rol==="admin";
  const eq  = equipos.find(e=>e.id===ot.equipoId);
  const cli = clientes.find(c=>c.id===ot.clienteId);
  const tec = usuarios.find(u=>u.id===ot.tecnicoId);
  const pri = PRIORIDADES.find(p=>p.id===ot.prioridad);
  const comentarios = ot.comentarios||[];

  function agregarComentario() {
    if (!nuevoComentario.trim()) return;
    const nuevo = { id:uid(), texto:nuevoComentario, autor:user.nombre, fecha:new Date().toISOString() };
    const actualizada = {...ot, comentarios:[...comentarios, nuevo]};
    setOrdenesTrabajo(ordenesTrabajos.map(o=>o.id===ot.id?actualizada:o));
    addLog(`Comentario en OT "${ot.titulo}"`);
    // notificar admin si es técnico
    if (user.rol==="tecnico") {
      const admins=usuarios.filter(u=>u.rol==="admin");
      const nn={...notificaciones};
      admins.forEach(a=>{nn[a.id]=[...(nn[a.id]||[]),{id:uid(),tipo:"comentario",referenciaId:ot.id,visto:false,fecha:new Date().toISOString(),texto:`Nuevo comentario en OT "${ot.titulo}" por ${user.nombre}`}];});
      setNotificaciones(nn);
    }
    setNuevoComentario("");
  }

  function guardarEdicion(data) {
    setOrdenesTrabajo(ordenesTrabajos.map(o=>o.id===ot.id?{...o,...data,comentarios:ot.comentarios}:o));
    addLog(`Editó OT: ${data.titulo}`);
    setEditando(false);
    onClose();
  }

  function cerrarOT() {
    setOrdenesTrabajo(ordenesTrabajos.map(o=>o.id===ot.id?{...o,estado:"cerrada",fechaCierre:new Date().toISOString()}:o));
    addLog(`Cerró OT: ${ot.titulo}`);
    onClose();
  }

  if (editando) return (
    <div>
      <button onClick={()=>setEditando(false)} style={{ background:"none", border:"none", color:"#f97316", cursor:"pointer", fontFamily:"DM Sans,sans-serif", fontSize:12, fontWeight:600, marginBottom:16 }}>← Volver</button>
      <OTForm data={ot} equipos={equipos} clientes={clientes} usuarios={usuarios} onSave={guardarEdicion} onCancel={()=>setEditando(false)}/>
    </div>
  );

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <Badge color={ot.estado==="abierta"?"#f97316":"#22c55e"}>{ot.estado==="abierta"?"Abierta":"Cerrada"}</Badge>
        <Badge color={pri?.color||"#64748b"}>{pri?.label}</Badge>
        <Badge color="#64748b" sm>{diasDesde(ot.fecha)} días abierta</Badge>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
        {[["Equipo",eq?`${eq.marca} ${eq.modelo}`:"—"],["Serie",eq?.serie||"—"],["Cliente",cli?.nombre||"—"],["Técnico",tec?.nombre||"Sin asignar"],["Abierta",fmtDT(ot.fecha)],["Cerrada",ot.fechaCierre?fmtDT(ot.fechaCierre):"—"]].map(([l,v])=>(
          <div key={l} style={{ padding:"8px 0", borderBottom:"1px solid #1e293b" }}>
            <div style={{ fontFamily:"DM Sans,sans-serif", color:"#64748b", fontSize:11, fontWeight:600, textTransform:"uppercase" }}>{l}</div>
            <div style={{ fontFamily:"DM Sans,sans-serif", color:"#e2e8f0", fontSize:13, marginTop:2 }}>{v}</div>
          </div>
        ))}
      </div>

      {ot.descripcion && <div style={{ marginBottom:16, padding:"12px", background:"#070d1a", borderRadius:8, fontFamily:"DM Sans,sans-serif", color:"#94a3b8", fontSize:13, lineHeight:1.6 }}>{ot.descripcion}</div>}

      {esAdmin && ot.estado==="abierta" && <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        <Btn variant="secondary" sm onClick={()=>setEditando(true)}>✏️ Editar</Btn>
        <Btn variant="success"   sm onClick={cerrarOT}>✅ Cerrar OT</Btn>
      </div>}

      {/* Comentarios */}
      <div style={{ borderTop:"1px solid #1e293b", paddingTop:16 }}>
        <SecLabel>Comentarios y seguimiento ({comentarios.length})</SecLabel>
        {comentarios.length===0 && <div style={{ fontFamily:"DM Sans,sans-serif", color:"#475569", fontSize:13, marginBottom:12 }}>Sin comentarios aún.</div>}
        {comentarios.map(c=>(
          <div key={c.id} style={{ marginBottom:10, padding:"10px 12px", background:"#070d1a", borderRadius:8, borderLeft:"3px solid #f97316" }}>
            <div style={{ fontFamily:"DM Sans,sans-serif", fontWeight:600, color:"#f97316", fontSize:11, marginBottom:4 }}>{c.autor} · {fmtDT(c.fecha)}</div>
            <div style={{ fontFamily:"DM Sans,sans-serif", color:"#e2e8f0", fontSize:13, lineHeight:1.6 }}>{c.texto}</div>
          </div>
        ))}
        {ot.estado==="abierta" && <div style={{ display:"flex", gap:8, marginTop:12 }}>
          <input style={{...iS,flex:1}} value={nuevoComentario} onChange={e=>setNuevoComentario(e.target.value)} placeholder="Agregar comentario..." onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&agregarComentario()}/>
          <Btn sm onClick={agregarComentario}>Enviar</Btn>
        </div>}
      </div>
    </div>
  );
}

// ── DASHBOARD 16:9 ────────────────────────────────────────────────────────────
function Dashboard({ setModulo }) {
  const { equipos, clientes, ordenesTrabajos, setOrdenesTrabajo, estadosEquipo, user, etiquetasCliente } = useApp();
  const [verOT,       setVerOT]       = useState(null);
  const [autoScroll,  setAutoScroll]  = useState(false);
  const scrollRef   = useRef(null);
  const timerRef    = useRef(null);
  const scrollTimer = useRef(null);

  const otAbiertas = ordenesTrabajos.filter(o=>o.estado==="abierta");
  const otRecientes  = otAbiertas.filter(o=>diasDesde(o.fecha)<7);
  const otMasDe7    = otAbiertas.filter(o=>diasDesde(o.fecha)>=7 && diasDesde(o.fecha)<30);
  const otMasDeUnMes = otAbiertas.filter(o=>diasDesde(o.fecha)>=30);

  const totalEq      = equipos.length;
  const operativos   = equipos.filter(e=>e.estado==="operativo").length;
  const inoperativos = equipos.filter(e=>e.estado!=="operativo").length;

  // Operatividad de clientes de alquiler (primer etiqueta = alquiler)
  const etiqAlquiler = etiquetasCliente[0];
  const clientesAlquiler = clientes.filter(c=>c.etiqueta===etiqAlquiler);
  const opClientes = clientesAlquiler.map(c=>{
    const eqsCliente = equipos.filter(e=>e.clienteId===c.id);
    if (!eqsCliente.length) return { ...c, pct:100 };
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const diasMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).getDate();
    let totalPct = 0;
    eqsCliente.forEach(eq=>{
      const diasInop = (eq.historialEstado||[]).filter(h=>{
        const d=new Date(h.fecha);
        return d>=inicioMes && d<=hoy && h.estado!=="operativo";
      }).length;
      totalPct += Math.max(0, ((diasMes-diasInop)/diasMes)*100);
    });
    return { ...c, pct: Math.round(totalPct/eqsCliente.length) };
  }).sort((a,b)=>b.pct-a.pct);

  // Auto-scroll tras 30s de inactividad
  useEffect(()=>{
    const reset=()=>{ setAutoScroll(false); clearTimeout(timerRef.current); timerRef.current=setTimeout(()=>setAutoScroll(true),30000); };
    window.addEventListener("mousemove",reset); window.addEventListener("keydown",reset); window.addEventListener("touchstart",reset);
    reset();
    return ()=>{ window.removeEventListener("mousemove",reset); window.removeEventListener("keydown",reset); window.removeEventListener("touchstart",reset); clearTimeout(timerRef.current); };
  },[]);

  useEffect(()=>{
    if (!autoScroll||!scrollRef.current) return;
    scrollTimer.current=setInterval(()=>{ if(scrollRef.current){ scrollRef.current.scrollTop+=1; if(scrollRef.current.scrollTop+scrollRef.current.clientHeight>=scrollRef.current.scrollHeight) scrollRef.current.scrollTop=0; }},30);
    return ()=>clearInterval(scrollTimer.current);
  },[autoScroll]);

  const OTCard=({ot,accentColor})=>{
    const eq=equipos.find(e=>e.id===ot.equipoId);
    const cli=clientes.find(c=>c.id===ot.clienteId);
    const tec=useApp().usuarios.find(u=>u.id===ot.tecnicoId);
    const pri=PRIORIDADES.find(p=>p.id===ot.prioridad);
    const dias=diasDesde(ot.fecha);
    return (
      <div onClick={()=>setVerOT(ot)} style={{ background:"#0d1525", border:`1px solid ${accentColor}44`, borderLeft:`4px solid ${accentColor}`, borderRadius:12, padding:"14px 16px", cursor:"pointer", marginBottom:10, transition:"all 0.15s" }}
        onMouseEnter={el=>el.currentTarget.style.background="#111827"} onMouseLeave={el=>el.currentTarget.style.background="#0d1525"}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
          <div style={{ fontFamily:"Syne,sans-serif", fontWeight:700, color:"#f1f5f9", fontSize:14, flex:1, marginRight:8 }}>{ot.titulo}</div>
          <Badge color={pri?.color||"#64748b"} sm>{pri?.label}</Badge>
        </div>
        <div style={{ fontFamily:"DM Sans,sans-serif", color:"#64748b", fontSize:12, display:"flex", flexWrap:"wrap", gap:"2px 10px" }}>
          {eq&&<span>🔧 {eq.marca} {eq.modelo} — <span style={{color:"#f97316"}}>{eq.serie}</span></span>}
          {cli&&<span>👤 {cli.nombre}</span>}
          {tec&&<span>🛠 {tec.nombre}</span>}
          <span style={{color:accentColor}}>📅 {dias} día{dias!==1?"s":""}</span>
        </div>
        {ot.descripcion&&<div style={{ fontFamily:"DM Sans,sans-serif", color:"#475569", fontSize:11, marginTop:6 }}>{ot.descripcion.substring(0,80)}{ot.descripcion.length>80?"…":""}</div>}
      </div>
    );
  };

  const ColHeader=({label,count,color})=>(
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, paddingBottom:10, borderBottom:`2px solid ${color}` }}>
      <div style={{ width:10, height:10, borderRadius:"50%", background:color, flexShrink:0 }}/>
      <span style={{ fontFamily:"Syne,sans-serif", fontWeight:800, color, fontSize:14, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</span>
      <span style={{ background:color+"22", color, border:`1px solid ${color}44`, borderRadius:20, padding:"1px 10px", fontSize:12, fontWeight:700, marginLeft:"auto" }}>{count}</span>
    </div>
  );

  const otVer = verOT ? ordenesTrabajos.find(o=>o.id===verOT.id) : null;

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>
      {/* HEADER BAR */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexShrink:0 }}>
        <div>
          <h1 style={{ fontFamily:"Syne,sans-serif", fontSize:20, fontWeight:800, color:"#f1f5f9", margin:0 }}>Dashboard — Órdenes Pendientes</h1>
          <p style={{ fontFamily:"DM Sans,sans-serif", fontSize:12, color:"#64748b", margin:"2px 0 0" }}>
            {otAbiertas.length} OT abiertas · {autoScroll&&<span style={{color:"#f97316"}}>▶ Auto-scroll activo</span>}
          </p>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          {/* Mini panel equipos */}
          <div style={{ background:"#0d1525", border:"1px solid #1e293b", borderRadius:10, padding:"8px 14px", display:"flex", gap:16 }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:20, color:"#3b82f6" }}>{totalEq}</div>
              <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:10, color:"#64748b", textTransform:"uppercase" }}>Total</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:20, color:"#22c55e" }}>{operativos}</div>
              <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:10, color:"#64748b", textTransform:"uppercase" }}>Operativos</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:20, color:"#ef4444" }}>{inoperativos}</div>
              <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:10, color:"#64748b", textTransform:"uppercase" }}>Inoperativos</div>
            </div>
          </div>
          {/* Mini operatividad */}
          {opClientes.length>0&&<div onClick={()=>setModulo("operatividad")} style={{ background:"#0d1525", border:"1px solid #1e293b", borderRadius:10, padding:"8px 14px", cursor:"pointer", minWidth:160 }}>
            <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:10, color:"#f97316", fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>Operatividad</div>
            {opClientes.slice(0,3).map(c=>(
              <div key={c.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:11, color:"#94a3b8" }}>{c.nombre.substring(0,14)}{c.nombre.length>14?"…":""}</span>
                <span style={{ fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:800, color:c.pct>=90?"#22c55e":c.pct>=70?"#f59e0b":"#ef4444" }}>{c.pct}%</span>
              </div>
            ))}
          </div>}
        </div>
      </div>

      {/* COLUMNAS OT */}
      <div ref={scrollRef} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, flex:1, overflowY:"auto", paddingBottom:8 }}>
        {/* Recientes < 7 días */}
        <div>
          <ColHeader label="Recientes" count={otRecientes.length} color="#22c55e"/>
          {otRecientes.length===0&&<div style={{ fontFamily:"DM Sans,sans-serif", color:"#334155", fontSize:13, textAlign:"center", padding:"20px 0" }}>Sin OT recientes</div>}
          {otRecientes.map(ot=><OTCard key={ot.id} ot={ot} accentColor="#22c55e"/>)}
        </div>
        {/* Más de 7 días */}
        <div>
          <ColHeader label="Más de 7 días" count={otMasDe7.length} color="#f59e0b"/>
          {otMasDe7.length===0&&<div style={{ fontFamily:"DM Sans,sans-serif", color:"#334155", fontSize:13, textAlign:"center", padding:"20px 0" }}>Sin OT en este rango</div>}
          {otMasDe7.map(ot=><OTCard key={ot.id} ot={ot} accentColor="#f59e0b"/>)}
        </div>
        {/* Más de 1 mes */}
        <div>
          <ColHeader label="Más de 1 mes" count={otMasDeUnMes.length} color="#ef4444"/>
          {otMasDeUnMes.length===0&&<div style={{ fontFamily:"DM Sans,sans-serif", color:"#334155", fontSize:13, textAlign:"center", padding:"20px 0" }}>Sin OT en este rango</div>}
          {otMasDeUnMes.map(ot=><OTCard key={ot.id} ot={ot} accentColor="#ef4444"/>)}
        </div>
      </div>

      {verOT&&otVer&&<Modal title={otVer.titulo} onClose={()=>setVerOT(null)} wide>
        <OTDetalle ot={otVer} onClose={()=>setVerOT(null)}/>
      </Modal>}
    </div>
  );
}

// ── ÓRDENES DE TRABAJO ────────────────────────────────────────────────────────
function OrdenesTrabajo({ setModulo }) {
  const { ordenesTrabajos, setOrdenesTrabajo, equipos, clientes, usuarios, user, addLog, notificaciones, setNotificaciones } = useApp();
  const [form,         setForm]         = useState(null);
  const [verOT,        setVerOT]        = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("abiertas");
  const [filtroTec,    setFiltroTec]    = useState("todos");
  const [filtroMes,    setFiltroMes]    = useState("todos");
  const esAdmin = user.rol==="admin";
  const tecnicos = usuarios.filter(u=>u.activo);
  const meses = [...new Set(ordenesTrabajos.map(o=>o.fecha?.substring(0,7)))].sort().reverse();

  const misFiltro = user.rol==="tecnico" ? ordenesTrabajos.filter(o=>o.tecnicoId===user.id) : ordenesTrabajos;
  const filtradas = misFiltro.filter(o=>{
    if(filtroEstado==="abiertas"&&o.estado!=="abierta") return false;
    if(filtroEstado==="cerradas"&&o.estado!=="cerrada") return false;
    if(filtroTec!=="todos"&&String(o.tecnicoId)!==filtroTec) return false;
    if(filtroMes!=="todos"&&!o.fecha?.startsWith(filtroMes)) return false;
    return true;
  }).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));

  function guardar(data) {
    const nueva={...data,id:uid(),estado:"abierta",fecha:new Date().toISOString(),fechaCierre:null,comentarios:[],creadoPor:user.id};
    setOrdenesTrabajo([...ordenesTrabajos,nueva]);
    addLog(`Creó OT: ${data.titulo}`);
    if(data.tecnicoId){
      const nn={...notificaciones};
      nn[data.tecnicoId]=[...(nn[data.tecnicoId]||[]),{id:uid(),tipo:"ot_asignada",referenciaId:nueva.id,visto:false,fecha:new Date().toISOString(),texto:`Se te asignó una OT: ${data.titulo}`}];
      setNotificaciones(nn);
    }
    setForm(null);
  }

  function marcarVista(otId){
    const nn={...notificaciones};
    nn[user.id]=(nn[user.id]||[]).map(n=>n.referenciaId===otId?{...n,visto:true}:n);
    setNotificaciones(nn);
  }

  const otVer=verOT?ordenesTrabajos.find(o=>o.id===verOT):null;
  const notifCount=(notificaciones[user.id]||[]).filter(n=>!n.visto).length;

  return (
    <div>
      <PageHeader title="Órdenes de Trabajo" sub={`${ordenesTrabajos.filter(o=>o.estado==="abierta").length} abiertas`} onBack={()=>setModulo("dashboard")} action={esAdmin&&<Btn onClick={()=>setForm({titulo:"",descripcion:"",equipoId:null,clienteId:"",tecnicoId:"",prioridad:"media"})}>+ Nueva OT</Btn>}/>

      <Card style={{marginBottom:20,padding:"14px 16px"}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:14,alignItems:"center"}}>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#64748b",fontWeight:600,textTransform:"uppercase"}}>Estado:</span>
            {[{v:"todas",l:"Todas"},{v:"abiertas",l:"Abiertas"},{v:"cerradas",l:"Cerradas"}].map(f=>(
              <button key={f.v} onClick={()=>setFiltroEstado(f.v)} style={{padding:"4px 12px",borderRadius:20,border:`1px solid ${filtroEstado===f.v?"#f97316":"#1e293b"}`,background:filtroEstado===f.v?"#f9731622":"transparent",color:filtroEstado===f.v?"#f97316":"#64748b",cursor:"pointer",fontSize:12,fontFamily:"DM Sans,sans-serif",fontWeight:600}}>{f.l}</button>
            ))}
          </div>
          {esAdmin&&<div style={{display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#64748b",fontWeight:600,textTransform:"uppercase"}}>Técnico:</span>
            <select style={{...iS,width:"auto",padding:"4px 10px",fontSize:12}} value={filtroTec} onChange={e=>setFiltroTec(e.target.value)}>
              <option value="todos">Todos</option>
              {tecnicos.map(u=><option key={u.id} value={String(u.id)}>{u.nombre}</option>)}
            </select>
          </div>}
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#64748b",fontWeight:600,textTransform:"uppercase"}}>Mes:</span>
            <select style={{...iS,width:"auto",padding:"4px 10px",fontSize:12}} value={filtroMes} onChange={e=>setFiltroMes(e.target.value)}>
              <option value="todos">Todos</option>
              {meses.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {filtradas.map(ot=>{
          const eq=equipos.find(e=>e.id===ot.equipoId);
          const tec=usuarios.find(u=>u.id===ot.tecnicoId);
          const cli=clientes.find(c=>c.id===ot.clienteId);
          const pri=PRIORIDADES.find(p=>p.id===ot.prioridad);
          const dias=diasDesde(ot.fecha);
          const notifNoVista=(notificaciones[user.id]||[]).some(n=>n.referenciaId===ot.id&&!n.visto);
          return <Card key={ot.id} style={{cursor:"pointer",borderLeft:`4px solid ${pri?.color||"#f97316"}`}} onClick={()=>{setVerOT(ot.id);marcarVista(ot.id);}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontFamily:"Syne,sans-serif",fontWeight:700,color:"#f1f5f9",fontSize:14}}>{ot.titulo}</span>
                  {notifNoVista&&<Dot/>}
                  <Badge color={ot.estado==="abierta"?"#f97316":"#22c55e"} sm>{ot.estado==="abierta"?"Abierta":"Cerrada"}</Badge>
                  <Badge color={pri?.color||"#64748b"} sm>{pri?.label}</Badge>
                  <Badge color={dias>=30?"#ef4444":dias>=7?"#f59e0b":"#22c55e"} sm>{dias}d</Badge>
                </div>
                <div style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:12,display:"flex",flexWrap:"wrap",gap:"3px 12px"}}>
                  {eq&&<span>🔧 {eq.marca} {eq.modelo} — {eq.serie}</span>}
                  {cli&&<span>👤 {cli.nombre}</span>}
                  {tec&&<span>🛠 {tec.nombre}</span>}
                  <span>📅 {fmt(ot.fecha)}</span>
                  <span>💬 {(ot.comentarios||[]).length} comentarios</span>
                </div>
              </div>
              <span style={{color:"#475569",fontSize:18,marginLeft:10}}>›</span>
            </div>
          </Card>;
        })}
        {filtradas.length===0&&<EmptyState msg="No hay órdenes de trabajo con estos filtros."/>}
      </div>

      {form&&<Modal title="Nueva Orden de Trabajo" onClose={()=>setForm(null)} wide><OTForm data={form} equipos={equipos} clientes={clientes} usuarios={usuarios} onSave={guardar} onCancel={()=>setForm(null)}/></Modal>}
      {otVer&&<Modal title={otVer.titulo} onClose={()=>setVerOT(null)} wide><OTDetalle ot={otVer} onClose={()=>setVerOT(null)}/></Modal>}
    </div>
  );
}

// ── EQUIPOS ───────────────────────────────────────────────────────────────────
function Equipos({ setModulo }) {
  const { equipos, setEquipos, clientes, estadosEquipo, setEstadosEquipo, tiposEquipo, setTiposEquipo, modelosPorTipo, setModelosPorTipo, user, addLog } = useApp();
  const [perfilId,    setPerfilId]    = useState(null);
  const [form,        setForm]        = useState(null);
  const [gestorTipos, setGestorTipos] = useState(false);
  const [gestorMod,   setGestorMod]   = useState(false);
  const [busqueda,    setBusqueda]    = useState("");
  const [filtroTipo,  setFiltroTipo]  = useState("todos");
  const [filtroEst,   setFiltroEst]   = useState("todos");
  const [filtroModelo,setFiltroModelo]= useState("todos");
  const esAdmin = user.rol==="admin";

  const totalEq      = equipos.length;
  const operativos   = equipos.filter(e=>e.estado==="operativo").length;
  const inoperativos = equipos.filter(e=>e.estado!=="operativo").length;

  if (perfilId) return <PerfilEquipo equipoId={perfilId} onVolver={()=>setPerfilId(null)} setModulo={setModulo}/>;

  const modelosDelTipo = filtroTipo!=="todos" ? (modelosPorTipo[filtroTipo]||[]) : [];

  const filtrados = equipos.filter(eq=>{
    const q=busqueda.toLowerCase();
    const ok=!busqueda||eq.serie?.toLowerCase().includes(q)||eq.marca?.toLowerCase().includes(q)||eq.modelo?.toLowerCase().includes(q)||clientes.find(c=>c.id===eq.clienteId)?.nombre?.toLowerCase().includes(q);
    return ok&&(filtroTipo==="todos"||eq.tipo===filtroTipo)&&(filtroEst==="todos"||eq.estado===filtroEst)&&(filtroModelo==="todos"||eq.modelo===filtroModelo);
  });

  function guardar(data) {
    if(data.id){setEquipos(equipos.map(e=>e.id===data.id?{...e,...data}:e));addLog(`Editó equipo: ${data.serie}`);}
    else{setEquipos([...equipos,{...data,id:uid(),historialEstado:[],fechaIngreso:new Date().toISOString().split("T")[0]}]);addLog(`Creó equipo: ${data.serie}`);}
    setForm(null);
  }

  return (
    <div>
      <PageHeader title="Equipos" onBack={()=>setModulo("dashboard")}
        action={<div style={{display:"flex",gap:8}}>
          {esAdmin&&<Btn variant="secondary" onClick={()=>setGestorTipos(true)}>⚙ Tipos</Btn>}
          {esAdmin&&<Btn onClick={()=>setForm({tipo:tiposEquipo[0]||"",marca:"",modelo:"",serie:"",horometro:"",clienteId:"",ubicacion:"",estado:estadosEquipo[0]?.id||"operativo",observaciones:"",esElectrico:false,bateriaAsignadaId:null,cargadorAsignadoId:null,esperandoRepuestos:false})}>+ Nuevo equipo</Btn>}
        </div>}/>

      {/* Contadores */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        {[{l:"Total equipos",v:totalEq,c:"#3b82f6"},{l:"Operativos",v:operativos,c:"#22c55e"},{l:"Inoperativos",v:inoperativos,c:"#ef4444"}].map(s=>(
          <Card key={s.l} style={{textAlign:"center",padding:"14px"}}>
            <div style={{fontFamily:"Syne,sans-serif",fontSize:26,fontWeight:800,color:s.c}}>{s.v}</div>
            <div style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#64748b",textTransform:"uppercase"}}>{s.l}</div>
          </Card>
        ))}
      </div>

      <div style={{marginBottom:12}}><Input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="🔍 Buscar por serie, marca, modelo o cliente..."/></div>

      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        {["todos",...tiposEquipo].map(t=>(
          <button key={t} onClick={()=>{setFiltroTipo(t);setFiltroModelo("todos");}}
            style={{padding:"4px 14px",borderRadius:20,border:`1px solid ${filtroTipo===t?"#f97316":"#1e293b"}`,background:filtroTipo===t?"#f9731622":"transparent",color:filtroTipo===t?"#f97316":"#64748b",cursor:"pointer",fontSize:12,fontFamily:"DM Sans,sans-serif",fontWeight:600}}>
            {t==="todos"?"Todos tipos":t}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
        {[{v:"todos",l:"Todos estados"},...estadosEquipo.map(e=>({v:e.id,l:e.label}))].map(f=>(
          <button key={f.v} onClick={()=>setFiltroEst(f.v)}
            style={{padding:"4px 14px",borderRadius:20,border:`1px solid ${filtroEst===f.v?"#8b5cf6":"#1e293b"}`,background:filtroEst===f.v?"#8b5cf622":"transparent",color:filtroEst===f.v?"#8b5cf6":"#64748b",cursor:"pointer",fontSize:12,fontFamily:"DM Sans,sans-serif",fontWeight:600}}>
            {f.l}
          </button>
        ))}
      </div>

      {filtroTipo!=="todos"&&<div style={{marginBottom:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#64748b",fontWeight:600,textTransform:"uppercase"}}>Modelos de {filtroTipo}</span>
          {esAdmin&&<button onClick={()=>setGestorMod(true)} style={{background:"none",border:"1px solid #1e293b",borderRadius:6,color:"#64748b",cursor:"pointer",padding:"3px 8px",fontSize:12}}>⚙ Modelos</button>}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[{v:"todos",l:"Todos modelos"},...modelosDelTipo.map(m=>({v:m,l:m}))].map(f=>{
            const cant = f.v==="todos" ? equipos.filter(e=>e.tipo===filtroTipo).length : equipos.filter(e=>e.tipo===filtroTipo&&e.modelo===f.v).length;
            return <button key={f.v} onClick={()=>setFiltroModelo(f.v)}
              style={{display:"flex",alignItems:"center",gap:6,padding:"4px 14px",borderRadius:20,border:`1px solid ${filtroModelo===f.v?"#3b82f6":"#1e293b"}`,background:filtroModelo===f.v?"#3b82f622":"transparent",color:filtroModelo===f.v?"#3b82f6":"#64748b",cursor:"pointer",fontSize:12,fontFamily:"DM Sans,sans-serif",fontWeight:600}}>
              {f.l}
              <span style={{background:"#ffffff14",borderRadius:10,padding:"0px 6px",fontSize:10}}>{cant}</span>
            </button>;
          })}
          {modelosDelTipo.length===0&&<span style={{fontFamily:"DM Sans,sans-serif",fontSize:12,color:"#475569"}}>Sin modelos cargados para este tipo todavía.</span>}
        </div>
      </div>}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
        {filtrados.map(eq=>{
          const cli=clientes.find(c=>c.id===eq.clienteId);
          const est=estadosEquipo.find(e=>e.id===eq.estado)||{color:"#64748b",label:eq.estado};
          return <Card key={eq.id} style={{cursor:"pointer",borderLeft:`4px solid ${est.color}`}} onClick={()=>setPerfilId(eq.id)}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,gap:6,flexWrap:"wrap"}}>
              <span style={{fontFamily:"DM Sans,sans-serif",fontWeight:700,color:"#f97316",fontSize:11,textTransform:"uppercase"}}>{eq.tipo}</span>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
                <Badge color={est.color} sm>{est.label}</Badge>
                {eq.esperandoRepuestos&&<Badge color="#f59e0b" sm>⏳ Repuestos</Badge>}
              </div>
            </div>
            <div style={{fontFamily:"Syne,sans-serif",fontWeight:700,color:"#f1f5f9",fontSize:15,marginBottom:6}}>{eq.marca} {eq.modelo}</div>
            <div style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:12,display:"flex",flexDirection:"column",gap:2}}>
              <div>🔢 <span style={{color:"#e2e8f0",fontWeight:600}}>{eq.serie}</span></div>
              <div>👤 {cli?.nombre||"—"}</div>
              {eq.horometro&&<div>⏱ {eq.horometro} h</div>}
              <div>📍 {eq.ubicacion||"—"}</div>
            </div>
          </Card>;
        })}
        {filtrados.length===0&&<div style={{gridColumn:"1/-1"}}><EmptyState msg="No se encontraron equipos."/></div>}
      </div>

      {form&&<Modal title={form.id?"Editar equipo":"Nuevo equipo"} onClose={()=>setForm(null)} wide>
        <EquipoForm data={form} equipos={equipos} clientes={clientes} tiposEquipo={tiposEquipo} estadosEquipo={estadosEquipo} modelosPorTipo={modelosPorTipo} setModelosPorTipo={setModelosPorTipo} onSave={guardar} onCancel={()=>setForm(null)}/>
      </Modal>}
      {gestorTipos&&<Modal title="Gestionar tipos de equipo" onClose={()=>setGestorTipos(false)}>
        <GestorLista items={tiposEquipo} setItems={setTiposEquipo} placeholder="Nuevo tipo..." onClose={()=>setGestorTipos(false)}/>
      </Modal>}
      {gestorMod&&<Modal title={`Gestionar modelos de ${filtroTipo}`} onClose={()=>setGestorMod(false)}>
        <GestorLista items={modelosPorTipo[filtroTipo]||[]} setItems={(nuevos)=>setModelosPorTipo(prev=>({...prev,[filtroTipo]:nuevos}))} placeholder="Nuevo modelo..." onClose={()=>setGestorMod(false)}/>
      </Modal>}
    </div>
  );
}

function PerfilEquipo({ equipoId, onVolver, setModulo }) {
  const { equipos, setEquipos, clientes, estadosEquipo, setEstadosEquipo, tiposEquipo, modelosPorTipo, setModelosPorTipo, ordenesTrabajos, setOrdenesTrabajo, user, addLog, notificaciones, setNotificaciones, usuarios } = useApp();
  const [formEditar, setFormEditar] = useState(null);
  const [gestorEst,  setGestorEst]  = useState(false);
  const [formOT,     setFormOT]     = useState(null);
  const [verOT,      setVerOT]      = useState(null);
  const esAdmin = user.rol==="admin";
  const eq = equipos.find(e=>e.id===equipoId);
  if (!eq) return null;
  const cliente = clientes.find(c=>c.id===eq.clienteId);
  const est = estadosEquipo.find(e=>e.id===eq.estado)||{label:eq.estado,color:"#64748b"};
  const otEq = ordenesTrabajos.filter(o=>o.equipoId===eq.id).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));

  function cambiarEstado(id){
    const ahora=new Date().toISOString();
    setEquipos(equipos.map(e=>e.id===eq.id?{...e,estado:id,historialEstado:[...(e.historialEstado||[]),{estado:id,fecha:ahora}]}:e));
    addLog(`Estado de ${eq.serie} → ${id}`);
  }

  function toggleEsperaRepuestos(){
    const nuevo = !eq.esperandoRepuestos;
    setEquipos(equipos.map(e=>e.id===eq.id?{...e,esperandoRepuestos:nuevo}:e));
    addLog(`${eq.serie}: ${nuevo?"marcado":"desmarcado"} como esperando repuestos`);
  }

  function guardarOT(data){
    const nueva={...data,id:uid(),equipoId:eq.id,clienteId:eq.clienteId,estado:"abierta",fecha:new Date().toISOString(),fechaCierre:null,comentarios:[],creadoPor:user.id};
    setOrdenesTrabajo([...ordenesTrabajos,nueva]);
    addLog(`Creó OT en ${eq.serie}: ${data.titulo}`);
    if(data.tecnicoId){const nn={...notificaciones};nn[data.tecnicoId]=[...(nn[data.tecnicoId]||[]),{id:uid(),tipo:"ot_asignada",referenciaId:nueva.id,visto:false,fecha:new Date().toISOString(),texto:`OT asignada: ${data.titulo}`}];setNotificaciones(nn);}
    setFormOT(null);
  }

  const otVer=verOT?ordenesTrabajos.find(o=>o.id===verOT):null;

  return <div>
    <button onClick={onVolver} style={{background:"none",border:"none",color:"#f97316",cursor:"pointer",fontFamily:"DM Sans,sans-serif",fontSize:12,fontWeight:600,marginBottom:16,padding:0}}>← Volver a equipos</button>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
      <div>
        <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:22,color:"#f1f5f9"}}>{eq.marca} {eq.modelo}</div>
        <div style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:13,marginTop:2}}>{eq.tipo} · Serie: <span style={{color:"#f97316",fontWeight:700}}>{eq.serie}</span></div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
          <Badge color={est.color}>{est.label}</Badge>
          {eq.esperandoRepuestos&&<Badge color="#f59e0b">⏳ Esperando repuestos</Badge>}
        </div>
        {esAdmin&&<Btn variant="secondary" sm onClick={()=>setFormEditar({...eq})}>✏️ Editar</Btn>}
      </div>
    </div>

    <Card style={{marginBottom:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {[["Tipo",eq.tipo],["Marca",eq.marca],["Modelo",eq.modelo],["Serie",eq.serie],["Horómetro",eq.horometro?`${eq.horometro} h`:"—"],["Cliente",cliente?.nombre||"—"],["Ubicación",eq.ubicacion||"—"],["Ingreso",fmt(eq.fechaIngreso)]].map(([l,v])=>(
          <div key={l} style={{padding:"8px 0",borderBottom:"1px solid #1e293b"}}>
            <div style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:11,fontWeight:600,textTransform:"uppercase"}}>{l}</div>
            <div style={{fontFamily:"DM Sans,sans-serif",color:"#e2e8f0",fontSize:13,marginTop:2}}>{v}</div>
          </div>
        ))}
      </div>
      {eq.observaciones&&<div style={{marginTop:12,padding:10,background:"#070d1a",borderRadius:8,fontFamily:"DM Sans,sans-serif",color:"#94a3b8",fontSize:13}}>{eq.observaciones}</div>}
    </Card>

    {(eq.tipo==="Montacargas"&&eq.esElectrico&&(eq.bateriaAsignadaId||eq.cargadorAsignadoId))&&<Card style={{marginBottom:16}}>
      <SecLabel>Componentes asignados</SecLabel>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:10}}>
        {eq.bateriaAsignadaId&&(()=>{const b=equipos.find(x=>x.id===eq.bateriaAsignadaId);return b?<div style={{fontFamily:"DM Sans,sans-serif",fontSize:13,color:"#e2e8f0"}}>🔋 Batería: {b.marca} {b.modelo} — Serie: <span style={{color:"#f97316",fontWeight:700}}>{b.serie}</span></div>:null;})()}
        {eq.cargadorAsignadoId&&(()=>{const c=equipos.find(x=>x.id===eq.cargadorAsignadoId);return c?<div style={{fontFamily:"DM Sans,sans-serif",fontSize:13,color:"#e2e8f0"}}>🔌 Cargador: {c.marca} {c.modelo} — Serie: <span style={{color:"#f97316",fontWeight:700}}>{c.serie}</span></div>:null;})()}
      </div>
    </Card>}
    {(eq.tipo==="Batería"||eq.tipo==="Cargador")&&(()=>{
      const m=equipos.find(x=>x.tipo==="Montacargas"&&x.esElectrico&&(x.bateriaAsignadaId===eq.id||x.cargadorAsignadoId===eq.id));
      return m?<Card style={{marginBottom:16}}>
        <SecLabel>Asignado a</SecLabel>
        <div style={{fontFamily:"DM Sans,sans-serif",fontSize:13,color:"#e2e8f0",marginTop:10}}>🏗 Montacargas: {m.marca} {m.modelo} — Serie: <span style={{color:"#f97316",fontWeight:700}}>{m.serie}</span></div>
      </Card>:null;
    })()}

    <Card style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <SecLabel>Cambiar estado</SecLabel>
        {esAdmin&&<button onClick={()=>setGestorEst(true)} style={{background:"none",border:"1px solid #1e293b",borderRadius:6,color:"#64748b",cursor:"pointer",padding:"3px 8px",fontSize:13}}>⚙</button>}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        {estadosEquipo.map(e=>(
          <button key={e.id} onClick={()=>cambiarEstado(e.id)}
            style={{padding:"5px 14px",borderRadius:20,border:`1px solid ${e.color}55`,background:eq.estado===e.id?e.color+"33":"transparent",color:e.color,cursor:"pointer",fontSize:11,fontFamily:"DM Sans,sans-serif",fontWeight:700}}>
            {e.label}
          </button>
        ))}
      </div>
      <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #1e293b"}}>
        <div style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#64748b",marginBottom:8}}>Esta etiqueta se puede combinar con el estado (ej: operativo + esperando repuestos)</div>
        <button onClick={toggleEsperaRepuestos}
          style={{padding:"5px 14px",borderRadius:20,border:"1px solid #f59e0b55",background:eq.esperandoRepuestos?"#f59e0b33":"transparent",color:"#f59e0b",cursor:"pointer",fontSize:11,fontFamily:"DM Sans,sans-serif",fontWeight:700}}>
          ⏳ {eq.esperandoRepuestos?"Esperando repuestos (activo)":"Marcar esperando repuestos"}
        </button>
      </div>
    </Card>

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div style={{fontFamily:"Syne,sans-serif",fontWeight:700,color:"#f1f5f9",fontSize:16}}>Órdenes de Trabajo ({otEq.length})</div>
      {esAdmin&&<Btn sm onClick={()=>setFormOT({titulo:"",descripcion:"",tecnicoId:"",prioridad:"media",clienteId:eq.clienteId})}>+ Nueva OT</Btn>}
    </div>
    {otEq.length===0&&<EmptyState msg="Sin OT para este equipo."/>}
    {otEq.map(ot=>{
      const pri=PRIORIDADES.find(p=>p.id===ot.prioridad);
      const dias=diasDesde(ot.fecha);
      return <Card key={ot.id} style={{marginBottom:10,cursor:"pointer",borderLeft:`4px solid ${pri?.color||"#f97316"}`}} onClick={()=>setVerOT(ot.id)}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <span style={{fontFamily:"Syne,sans-serif",fontWeight:700,color:"#f1f5f9",fontSize:14}}>{ot.titulo}</span>
              <Badge color={ot.estado==="abierta"?"#f97316":"#22c55e"} sm>{ot.estado==="abierta"?"Abierta":"Cerrada"}</Badge>
              <Badge color={pri?.color||"#64748b"} sm>{pri?.label}</Badge>
            </div>
            <div style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:12}}>{fmtDT(ot.fecha)} · {dias}d · 💬 {(ot.comentarios||[]).length}</div>
          </div>
          <span style={{color:"#475569",fontSize:18}}>›</span>
        </div>
      </Card>;
    })}

    {formEditar&&<Modal title="Editar equipo" onClose={()=>setFormEditar(null)} wide>
      <EquipoForm data={formEditar} equipos={equipos} clientes={clientes} tiposEquipo={tiposEquipo} estadosEquipo={estadosEquipo} modelosPorTipo={modelosPorTipo} setModelosPorTipo={setModelosPorTipo} onSave={d=>{setEquipos(equipos.map(e=>e.id===eq.id?{...e,...d}:e));addLog(`Editó equipo: ${eq.serie}`);setFormEditar(null);}} onCancel={()=>setFormEditar(null)}/>
    </Modal>}
    {gestorEst&&<Modal title="Gestionar estados" onClose={()=>setGestorEst(false)}><GestorEstados estados={estadosEquipo} setEstados={setEstadosEquipo} onClose={()=>setGestorEst(false)}/></Modal>}
    {formOT&&<Modal title="Nueva OT" onClose={()=>setFormOT(null)} wide><OTForm data={formOT} equipos={equipos} clientes={clientes} usuarios={usuarios} onSave={guardarOT} onCancel={()=>setFormOT(null)}/></Modal>}
    {otVer&&<Modal title={otVer.titulo} onClose={()=>setVerOT(null)} wide><OTDetalle ot={otVer} onClose={()=>setVerOT(null)}/></Modal>}
  </div>;
}

function EquipoForm({ data, equipos, clientes, tiposEquipo, estadosEquipo, modelosPorTipo, setModelosPorTipo, onSave, onCancel }) {
  const [f,setF]=useState(data); const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const [gestorMod,setGestorMod]=useState(false);
  function setTipo(v){
    setF(p=>({...p, tipo:v, modelo:"", ...(v!=="Montacargas"?{esElectrico:false,bateriaAsignadaId:null,cargadorAsignadoId:null}:{})}));
  }
  const modelosDelTipo = (modelosPorTipo && modelosPorTipo[f.tipo]) || [];
  const otrosEquipos = (equipos||[]).filter(e=>e.id!==f.id);
  const bateriasDisponibles = otrosEquipos.filter(e=>e.tipo==="Batería");
  const cargadoresDisponibles = otrosEquipos.filter(e=>e.tipo==="Cargador");
  return <div style={{display:"flex",flexWrap:"wrap",gap:14}}>
    <Field label="Tipo"><Sel value={f.tipo} onChange={e=>setTipo(e.target.value)} options={tiposEquipo.map(t=>({v:t,l:t}))}/></Field>
    <Field label="Marca" half><Input value={f.marca} onChange={e=>set("marca",e.target.value)} placeholder="Crown, Enersys..."/></Field>
    <Field label="Modelo" half>
      <div style={{display:"flex",gap:6}}>
        <div style={{flex:1}}><Sel value={f.modelo||""} onChange={e=>set("modelo",e.target.value)} options={[{v:"",l:"— Elegir modelo —"},...modelosDelTipo.map(m=>({v:m,l:m}))]}/></div>
        <button type="button" onClick={()=>setGestorMod(true)} style={{background:"none",border:"1px solid #1e293b",borderRadius:6,color:"#64748b",cursor:"pointer",padding:"0 10px",fontSize:13}}>⚙</button>
      </div>
    </Field>
    <Field label="Número de serie"><Input value={f.serie} onChange={e=>set("serie",e.target.value)} placeholder="CRW-2024-001"/></Field>
    <Field label="Horómetro (h)" half><Input value={f.horometro} onChange={e=>set("horometro",e.target.value)} type="number" placeholder="Opcional"/></Field>
    <Field label="Cliente" half><Sel value={f.clienteId||""} onChange={e=>set("clienteId",Number(e.target.value))} options={[{v:"",l:"— Sin cliente —"},...clientes.map(c=>({v:c.id,l:c.nombre}))]}/></Field>
    <Field label="Ubicación"><Input value={f.ubicacion} onChange={e=>set("ubicacion",e.target.value)} placeholder="Taller, obra, sitio..."/></Field>
    <Field label="Estado"><Sel value={f.estado} onChange={e=>set("estado",e.target.value)} options={estadosEquipo.map(e=>({v:e.id,l:e.label}))}/></Field>
    {f.tipo==="Montacargas"&&<div style={{width:"100%",display:"flex",flexDirection:"column",gap:10,padding:12,background:"#070d1a",border:"1px solid #1e293b",borderRadius:8}}>
      <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontFamily:"DM Sans,sans-serif",fontSize:13,color:"#e2e8f0"}}>
        <input type="checkbox" checked={!!f.esElectrico} onChange={e=>set("esElectrico",e.target.checked)}/>
        ¿Es eléctrico? (tiene batería y cargador asignados)
      </label>
      {f.esElectrico&&<>
        <Field label="Batería asignada"><BuscadorEquipo equipos={bateriasDisponibles} clientes={clientes} selected={f.bateriaAsignadaId} onSelect={id=>set("bateriaAsignadaId",id)}/></Field>
        <Field label="Cargador asignado"><BuscadorEquipo equipos={cargadoresDisponibles} clientes={clientes} selected={f.cargadorAsignadoId} onSelect={id=>set("cargadorAsignadoId",id)}/></Field>
      </>}
    </div>}
    <Field label="Observaciones"><Input value={f.observaciones} onChange={e=>set("observaciones",e.target.value)} textarea/></Field>
    <div style={{display:"flex",gap:10,width:"100%",marginTop:4}}><Btn onClick={()=>onSave(f)}>Guardar</Btn><Btn variant="secondary" onClick={onCancel}>Cancelar</Btn></div>
    {gestorMod&&<Modal title={`Gestionar modelos de ${f.tipo}`} onClose={()=>setGestorMod(false)}>
      <GestorLista items={modelosDelTipo} setItems={(nuevos)=>setModelosPorTipo(prev=>({...prev,[f.tipo]:nuevos}))} placeholder="Nuevo modelo..." onClose={()=>setGestorMod(false)}/>
    </Modal>}
  </div>;
}

// ── CLIENTES ──────────────────────────────────────────────────────────────────
function Clientes({ setModulo }) {
  const { clientes, setClientes, equipos, user, addLog, etiquetasCliente, setEtiquetasCliente } = useApp();
  const [form,         setForm]         = useState(null);
  const [ver,          setVer]          = useState(null);
  const [gestorEtiq,   setGestorEtiq]   = useState(false);
  const esAdmin = user.rol==="admin";

  function guardar(data){
    if(data.id){setClientes(clientes.map(c=>c.id===data.id?data:c));}
    else{setClientes([...clientes,{...data,id:uid()}]);}
    addLog(`Cliente: ${data.nombre}`); setForm(null);
  }

  return <div>
    <PageHeader title="Clientes" sub={`${clientes.length} clientes`} onBack={()=>setModulo("dashboard")}
      action={<div style={{display:"flex",gap:8}}>
        {esAdmin&&<Btn variant="secondary" onClick={()=>setGestorEtiq(true)}>⚙ Etiquetas</Btn>}
        {esAdmin&&<Btn onClick={()=>setForm({nombre:"",contacto:"",correo:"",telefono:"",direccion:"",observaciones:"",etiqueta:etiquetasCliente[0]||""})}>+ Nuevo cliente</Btn>}
      </div>}/>

    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {clientes.map(c=>{
        const eqsCliente=equipos.filter(e=>e.clienteId===c.id);
        return <Card key={c.id} style={{cursor:"pointer"}} onClick={()=>setVer(c)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{fontFamily:"Syne,sans-serif",fontWeight:700,color:"#f1f5f9",fontSize:15}}>{c.nombre}</span>
                {c.etiqueta&&<Badge color="#f97316" sm>{c.etiqueta}</Badge>}
              </div>
              {c.contacto&&<div style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:12}}>👤 {c.contacto}</div>}
              {c.telefono&&<div style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:12}}>📞 {c.telefono}</div>}
              {c.correo&&<div style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:12}}>✉️ {c.correo}</div>}
              <div style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:12,marginTop:4}}>🏗 {eqsCliente.length} equipo{eqsCliente.length!==1?"s":""} asignado{eqsCliente.length!==1?"s":""}</div>
            </div>
            {esAdmin&&<div style={{display:"flex",gap:8}} onClick={e=>e.stopPropagation()}>
              <Btn variant="secondary" sm onClick={()=>setForm(c)}>Editar</Btn>
              <Btn variant="danger" sm onClick={()=>{setClientes(clientes.filter(x=>x.id!==c.id));addLog(`Eliminó cliente: ${c.nombre}`);}}>✕</Btn>
            </div>}
          </div>
        </Card>;
      })}
      {clientes.length===0&&<EmptyState msg="No hay clientes registrados."/>}
    </div>

    {form&&<Modal title={form.id?"Editar cliente":"Nuevo cliente"} onClose={()=>setForm(null)}>
      <div style={{display:"flex",flexWrap:"wrap",gap:14}}>
        <Field label="Nombre"><Input value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} placeholder="Empresa o persona"/></Field>
        <Field label="Etiqueta / Tipo">
          <Sel value={form.etiqueta||""} onChange={e=>setForm(p=>({...p,etiqueta:e.target.value}))} options={[{v:"",l:"— Sin etiqueta —"},...etiquetasCliente.map(et=>({v:et,l:et}))]}/>
        </Field>
        <Field label="Contacto"><Input value={form.contacto} onChange={e=>setForm(p=>({...p,contacto:e.target.value}))}/></Field>
        <Field label="Correo" half><Input value={form.correo} onChange={e=>setForm(p=>({...p,correo:e.target.value}))} type="email"/></Field>
        <Field label="Teléfono" half><Input value={form.telefono} onChange={e=>setForm(p=>({...p,telefono:e.target.value}))}/></Field>
        <Field label="Dirección"><Input value={form.direccion} onChange={e=>setForm(p=>({...p,direccion:e.target.value}))}/></Field>
        <Field label="Observaciones"><Input value={form.observaciones} onChange={e=>setForm(p=>({...p,observaciones:e.target.value}))} textarea/></Field>
        <div style={{display:"flex",gap:10,width:"100%",marginTop:4}}><Btn onClick={()=>guardar(form)}>Guardar</Btn><Btn variant="secondary" onClick={()=>setForm(null)}>Cancelar</Btn></div>
      </div>
    </Modal>}

    {ver&&<Modal title={ver.nombre} onClose={()=>setVer(null)} wide>
      <ClienteDetalle cliente={ver} onEdit={()=>{setForm(ver);setVer(null);}}/>
    </Modal>}

    {gestorEtiq&&<Modal title="Gestionar etiquetas de cliente" onClose={()=>setGestorEtiq(false)}>
      <GestorLista items={etiquetasCliente} setItems={setEtiquetasCliente} placeholder="Nueva etiqueta (ej: Alquiler, Cliente propio...)" onClose={()=>setGestorEtiq(false)}/>
    </Modal>}
  </div>;
}

function ClienteDetalle({ cliente: c, onEdit }) {
  const { equipos, estadosEquipo, esAdmin, user } = useApp();
  const eqsCliente = equipos.filter(e=>e.clienteId===c.id);
  const esA = user.rol==="admin";
  return <div>
    <div style={{display:"flex",gap:8,marginBottom:16}}>
      {c.etiqueta&&<Badge color="#f97316">{c.etiqueta}</Badge>}
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:16}}>
      {[["Contacto",c.contacto],["Correo",c.correo],["Teléfono",c.telefono],["Dirección",c.direccion],["Observaciones",c.observaciones]].map(([l,v])=>v?<div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #1e293b"}}><span style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:12,fontWeight:600}}>{l}</span><span style={{fontFamily:"DM Sans,sans-serif",color:"#e2e8f0",fontSize:13,maxWidth:"60%",textAlign:"right"}}>{v}</span></div>:null)}
    </div>
    <SecLabel>Equipos asignados ({eqsCliente.length})</SecLabel>
    {eqsCliente.length===0&&<EmptyState msg="Sin equipos asignados."/>}
    {eqsCliente.map(eq=>{
      const est=estadosEquipo.find(e=>e.id===eq.estado)||{color:"#64748b",label:eq.estado};
      return <div key={eq.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #1e293b"}}>
        <div>
          <div style={{fontFamily:"DM Sans,sans-serif",fontWeight:600,color:"#f1f5f9",fontSize:13}}>{eq.marca} {eq.modelo}</div>
          <div style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:11}}>{eq.tipo} · Serie: {eq.serie} · {eq.ubicacion}</div>
        </div>
        <Badge color={est.color} sm>{est.label}</Badge>
      </div>;
    })}
    {esA&&<div style={{marginTop:16}}><Btn variant="secondary" sm onClick={onEdit}>✏️ Editar cliente</Btn></div>}
  </div>;
}

// ── OPERATIVIDAD ──────────────────────────────────────────────────────────────
function Operatividad({ setModulo }) {
  const { clientes, equipos, estadosEquipo } = useApp();
  const [mes, setMes] = useState(()=>{
    const hoy=new Date(); return `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}`;
  });
  function calcOpCliente(cliente) {
    const eqsCli = equipos.filter(e=>e.clienteId===cliente.id && e.tipo!=="Batería" && e.tipo!=="Cargador");
    if (!eqsCli.length) return { pct:100, equipos:[] };
    const [anio,mesN]=mes.split("-").map(Number);
    const inicioMes=new Date(anio,mesN-1,1);
    const finMes=new Date(anio,mesN,0,23,59,59);
    const diasMes=finMes.getDate();
    const hoy=new Date();
    const diasTranscurridos=Math.min(hoy.getDate(),(hoy.getFullYear()===anio&&hoy.getMonth()===mesN-1)?hoy.getDate():diasMes);

    const eqsCalc = eqsCli.map(eq=>{
      const historial=(eq.historialEstado||[]).filter(h=>{
        const d=new Date(h.fecha); return d>=inicioMes&&d<=finMes;
      }).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));

      // contar días inoperativo
      let diasInop=0;
      let estadoActual=eq.estado;
      // reconstruir simple: si algún momento fue inoperativo
      historial.forEach(h=>{ if(h.estado!=="operativo") diasInop++; });
      // ajustar al máximo días transcurridos
      diasInop=Math.min(diasInop,diasTranscurridos);
      const pct=Math.max(0,Math.round(((diasTranscurridos-diasInop)/diasTranscurridos)*100));
      return { ...eq, diasInop, pct, estado:estadoActual };
    });

    const pctGlobal=Math.round(eqsCalc.reduce((s,e)=>s+e.pct,0)/eqsCalc.length);
    return { pct:pctGlobal, equipos:eqsCalc };
  }

  const clientesFiltrados = clientes
    .filter(c=>c.etiqueta==="Alquiler")
    .map(c=>({ ...c, ...calcOpCliente(c) }))
    .sort((a,b)=>b.pct-a.pct);

  function colorPct(p){ return p>=90?"#22c55e":p>=70?"#f59e0b":"#ef4444"; }

  return <div>
    <PageHeader title="Operatividad de clientes" sub="Porcentaje de operación en el mes — solo clientes de alquiler" onBack={()=>setModulo("dashboard")}/>

    <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <span style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#64748b",fontWeight:600,textTransform:"uppercase"}}>Mes:</span>
        <input type="month" style={{...iS,width:"auto",padding:"6px 10px"}} value={mes} onChange={e=>setMes(e.target.value)}/>
      </div>
    </div>

    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {clientesFiltrados.map(c=>(
        <Card key={c.id}>
          {/* Cabecera cliente */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div>
                <div style={{fontFamily:"Syne,sans-serif",fontWeight:700,color:"#f1f5f9",fontSize:16}}>{c.nombre}</div>
                {c.etiqueta&&<Badge color="#f97316" sm>{c.etiqueta}</Badge>}
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:32,color:colorPct(c.pct),lineHeight:1}}>{c.pct}%</div>
              <div style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#64748b"}}>Operatividad global</div>
            </div>
          </div>

          {/* Barra global */}
          <div style={{background:"#1e293b",borderRadius:8,height:8,marginBottom:14,overflow:"hidden"}}>
            <div style={{background:colorPct(c.pct),height:"100%",width:`${c.pct}%`,borderRadius:8,transition:"width 0.5s"}}/>
          </div>

          {/* Equipos */}
          {c.equipos.length===0&&<div style={{fontFamily:"DM Sans,sans-serif",color:"#475569",fontSize:13}}>Sin equipos asignados.</div>}
          {c.equipos.map(eq=>{
            const est=useApp().estadosEquipo.find(e=>e.id===eq.estado)||{color:"#64748b",label:eq.estado};
            return <div key={eq.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #1e293b"}}>
              <div>
                <div style={{fontFamily:"DM Sans,sans-serif",fontWeight:600,color:"#e2e8f0",fontSize:13}}>{eq.marca} {eq.modelo} <span style={{color:"#f97316"}}>— {eq.serie}</span></div>
                <div style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:11,marginTop:2}}>
                  <Badge color={est.color} sm>{est.label}</Badge>
                  {eq.diasInop>0&&<span style={{marginLeft:8,color:"#ef4444"}}>⚠️ {eq.diasInop} día{eq.diasInop!==1?"s":""} inoperativo este mes</span>}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{background:"#1e293b",borderRadius:6,height:6,width:80,overflow:"hidden"}}>
                  <div style={{background:colorPct(eq.pct),height:"100%",width:`${eq.pct}%`,borderRadius:6}}/>
                </div>
                <span style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:16,color:colorPct(eq.pct),minWidth:42,textAlign:"right"}}>{eq.pct}%</span>
              </div>
            </div>;
          })}
        </Card>
      ))}
      {clientesFiltrados.length===0&&<EmptyState msg="No hay clientes de alquiler registrados."/>}
    </div>
  </div>;
}

// ── USUARIOS ──────────────────────────────────────────────────────────────────
function Usuarios({ setModulo }) {
  const { usuarios, setUsuarios, user, addLog } = useApp();
  const [form,setForm]=useState(null);
  const [nuevo,setNuevo]=useState(null);
  const [creando,setCreando]=useState(false);
  const [errorNuevo,setErrorNuevo]=useState("");
  const [reset,setReset]=useState(null);
  const [reseteando,setReseteando]=useState(false);
  const [errorReset,setErrorReset]=useState("");
  const esAdmin=user.rol==="admin";

  async function recargarUsuarios(){
    if(!supabase) return;
    const { data, error } = await supabase.from("profiles").select("*").order("nombre");
    if(!error) setUsuarios((data||[]).map(p=>({ id:p.id, nombre:p.nombre||p.email, usuario:p.email, rol:p.rol, activo:p.activo })));
  }

  async function guardar(data){
    const { error } = await supabase.from("profiles").update({ nombre:data.nombre, rol:data.rol }).eq("id", data.id);
    if(error){ addLog("Error al guardar usuario", error.message); setForm(null); return; }
    setUsuarios(usuarios.map(u=>u.id===data.id?{...u,...data}:u));
    addLog(`Usuario editado: ${data.nombre}`);
    setForm(null);
  }
  async function desactivar(u){
    const { error } = await supabase.from("profiles").update({ activo:false }).eq("id", u.id);
    if(error){ addLog("Error al desactivar usuario", error.message); return; }
    setUsuarios(usuarios.map(x=>x.id===u.id?{...x,activo:false}:x));
    addLog(`Desactivó usuario: ${u.nombre}`);
  }
  async function reactivar(u){
    const { error } = await supabase.from("profiles").update({ activo:true }).eq("id", u.id);
    if(error){ addLog("Error al reactivar usuario", error.message); return; }
    setUsuarios(usuarios.map(x=>x.id===u.id?{...x,activo:true}:x));
    addLog(`Reactivó usuario: ${u.nombre}`);
  }
  async function crearUsuario(data){
    setCreando(true); setErrorNuevo("");
    const { data: res, error } = await supabase.functions.invoke("create-user", { body: { accion:"crear", ...data } });
    setCreando(false);
    const errMsg = error?.message || res?.error;
    if(errMsg){ setErrorNuevo(errMsg); return; }
    addLog(`Usuario creado: ${data.nombre||data.email}`);
    setNuevo(null);
    recargarUsuarios();
  }
  async function restablecer(){
    setReseteando(true); setErrorReset("");
    const { data: res, error } = await supabase.functions.invoke("create-user", { body: { accion:"reset-password", userId: reset.id, password: reset.password } });
    setReseteando(false);
    const errMsg = error?.message || res?.error;
    if(errMsg){ setErrorReset(errMsg); return; }
    addLog(`Restableció contraseña de: ${reset.nombre}`);
    setReset(null);
  }

  if(!esAdmin)return <div><PageHeader title="Usuarios" onBack={()=>setModulo("dashboard")}/><Card><EmptyState msg="Solo administradores pueden gestionar usuarios."/></Card></div>;
  return <div>
    <PageHeader title="Usuarios" onBack={()=>setModulo("dashboard")} action={<Btn onClick={()=>{setNuevo({email:"",password:"",nombre:"",rol:"tecnico"});setErrorNuevo("");}}>+ Nuevo usuario</Btn>}/>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {usuarios.map(u=><Card key={u.id}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div><div style={{fontFamily:"Syne,sans-serif",fontWeight:700,color:"#f1f5f9",fontSize:15}}>{u.nombre}</div><div style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:12,marginTop:2}}>{u.usuario} · {ROLES[u.rol]}</div></div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <Badge color={u.activo?"#22c55e":"#64748b"}>{u.activo?"Activo":"Inactivo"}</Badge>
            <Btn variant="secondary" sm onClick={()=>{setReset({id:u.id,nombre:u.nombre,password:""});setErrorReset("");}}>🔑 Restablecer contraseña</Btn>
            {u.id!==user.id&&<Btn variant="secondary" sm onClick={()=>setForm(u)}>Editar</Btn>}
            {u.id!==user.id&&u.activo&&<Btn variant="danger" sm onClick={()=>desactivar(u)}>Desactivar</Btn>}
            {u.id!==user.id&&!u.activo&&<Btn variant="success" sm onClick={()=>reactivar(u)}>Reactivar</Btn>}
          </div>
        </div>
      </Card>)}
    </div>
    {form&&<Modal title="Editar usuario" onClose={()=>setForm(null)}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Field label="Nombre"><Input value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/></Field>
        <Field label="Rol"><Sel value={form.rol} onChange={e=>setForm(p=>({...p,rol:e.target.value}))} options={Object.entries(ROLES).map(([v,l])=>({v,l}))}/></Field>
        <div style={{display:"flex",gap:10,marginTop:8}}><Btn onClick={()=>guardar(form)}>Guardar</Btn><Btn variant="secondary" onClick={()=>setForm(null)}>Cancelar</Btn></div>
      </div>
    </Modal>}
    {nuevo&&<Modal title="Nuevo usuario" onClose={()=>setNuevo(null)}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Field label="Email"><Input value={nuevo.email} onChange={e=>setNuevo(p=>({...p,email:e.target.value}))} placeholder="empleado@empresa.com"/></Field>
        <Field label="Contraseña inicial"><Input value={nuevo.password} onChange={e=>setNuevo(p=>({...p,password:e.target.value}))} type="password" placeholder="mínimo 6 caracteres"/></Field>
        <Field label="Nombre"><Input value={nuevo.nombre} onChange={e=>setNuevo(p=>({...p,nombre:e.target.value}))}/></Field>
        <Field label="Rol"><Sel value={nuevo.rol} onChange={e=>setNuevo(p=>({...p,rol:e.target.value}))} options={Object.entries(ROLES).map(([v,l])=>({v,l}))}/></Field>
        {errorNuevo&&<div style={{color:"#ef4444",fontSize:12,fontFamily:"DM Sans,sans-serif"}}>{errorNuevo}</div>}
        <div style={{display:"flex",gap:10,marginTop:8}}><Btn disabled={creando} onClick={()=>crearUsuario(nuevo)}>{creando?"Creando…":"Crear usuario"}</Btn><Btn variant="secondary" onClick={()=>setNuevo(null)}>Cancelar</Btn></div>
      </div>
    </Modal>}
    {reset&&<Modal title={`Restablecer contraseña — ${reset.nombre}`} onClose={()=>setReset(null)}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Field label="Contraseña nueva"><Input value={reset.password} onChange={e=>setReset(p=>({...p,password:e.target.value}))} type="password" placeholder="mínimo 6 caracteres"/></Field>
        {errorReset&&<div style={{color:"#ef4444",fontSize:12,fontFamily:"DM Sans,sans-serif"}}>{errorReset}</div>}
        <div style={{display:"flex",gap:10,marginTop:8}}><Btn disabled={reseteando} onClick={restablecer}>{reseteando?"Guardando…":"Guardar nueva contraseña"}</Btn><Btn variant="secondary" onClick={()=>setReset(null)}>Cancelar</Btn></div>
      </div>
    </Modal>}
  </div>;
}

// ── ACTIVIDAD ─────────────────────────────────────────────────────────────────
function LogActividad({ setModulo }) {
  const { log, usuarios } = useApp();
  return <div>
    <PageHeader title="Registro de actividad" onBack={()=>setModulo("dashboard")}/>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {log.slice().reverse().map(entry=>{
        const u=usuarios.find(u=>u.id===entry.usuarioId);
        return <Card key={entry.id} style={{padding:"12px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><span style={{fontFamily:"DM Sans,sans-serif",fontWeight:600,color:"#e2e8f0",fontSize:13}}>{entry.accion}</span>{entry.detalle&&<span style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:12}}> — {entry.detalle}</span>}<div style={{fontFamily:"DM Sans,sans-serif",color:"#475569",fontSize:11,marginTop:2}}>👤 {u?.nombre||"Sistema"}</div></div>
            <div style={{fontFamily:"DM Sans,sans-serif",color:"#334155",fontSize:11,flexShrink:0,marginLeft:12}}>{fmtDT(entry.fecha)}</div>
          </div>
        </Card>;
      })}
      {log.length===0&&<EmptyState msg="Sin actividad."/>}
    </div>
  </div>;
}

// ── GESTORES ──────────────────────────────────────────────────────────────────
function GestorLista({ items, setItems, placeholder, onClose }) {
  const [nuevo,setNuevo]=useState("");
  const agregar=()=>{ const t=nuevo.trim(); if(t&&!items.includes(t)){setItems([...items,t]);setNuevo("");} };
  return <div>
    <div style={{display:"flex",gap:8,marginBottom:16}}><input style={{...iS,flex:1}} value={nuevo} onChange={e=>setNuevo(e.target.value)} placeholder={placeholder} onKeyDown={e=>e.key==="Enter"&&agregar()}/><Btn onClick={agregar}>Agregar</Btn></div>
    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
      {items.map(t=><div key={t} style={{display:"flex",alignItems:"center",gap:6,background:"#070d1a",border:"1px solid #1e293b",borderRadius:8,padding:"6px 12px"}}>
        <span style={{fontFamily:"DM Sans,sans-serif",fontSize:13,color:"#e2e8f0"}}>{t}</span>
        <button onClick={()=>setItems(items.filter(x=>x!==t))} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:14}}>✕</button>
      </div>)}
    </div>
    <div style={{marginTop:20}}><Btn variant="secondary" onClick={onClose}>Cerrar</Btn></div>
  </div>;
}

function GestorEstados({ estados, setEstados, onClose }) {
  const [label,setLabel]=useState(""); const [color,setColor]=useState("#3b82f6");
  function agregar(){const t=label.trim();if(!t)return;const id=t.toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,"");if(estados.find(e=>e.id===id))return;setEstados([...estados,{id,label:t,color}]);setLabel("");}
  return <div>
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}><input style={{...iS,flex:1,minWidth:140}} value={label} onChange={e=>setLabel(e.target.value)} placeholder="Nuevo estado..." onKeyDown={e=>e.key==="Enter"&&agregar()}/><input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{width:40,height:40,borderRadius:6,border:"1px solid #1e293b",cursor:"pointer",background:"none"}}/><Btn onClick={agregar}>Agregar</Btn></div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>{estados.map(e=><div key={e.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#070d1a",border:"1px solid #1e293b",borderRadius:8,padding:"8px 12px"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:12,height:12,borderRadius:"50%",background:e.color}}/><span style={{fontFamily:"DM Sans,sans-serif",fontSize:13,color:"#e2e8f0"}}>{e.label}</span></div><button onClick={()=>setEstados(estados.filter(x=>x.id!==e.id))} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:16}}>✕</button></div>)}</div>
    <div style={{marginTop:20}}><Btn variant="secondary" onClick={onClose}>Cerrar</Btn></div>
  </div>;
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function Login() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
  async function ingresar(){
    if(!supabase){ setError("Falta configurar Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)."); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if(error) setError("Email o contraseña incorrectos.");
  }
  return <div style={{minHeight:"100vh",background:"#070d1a",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <style>{fonts}</style>
    <div style={{width:"100%",maxWidth:380}}>
      <div style={{textAlign:"center",marginBottom:40}}>
        <div style={{fontSize:48,marginBottom:12}}>⚙️</div>
        <h1 style={{fontFamily:"Syne,sans-serif",fontSize:28,fontWeight:800,color:"#f97316",margin:0}}>TallerPro</h1>
        <p style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",margin:"6px 0 0",fontSize:14}}>Baterías & Cargadores — COAMCO</p>
      </div>
      <Card>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Field label="Email"><Input value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu_email@empresa.com" autoCapitalize="none" autoCorrect="off" autoComplete="username" spellCheck={false}/></Field>
          <Field label="Contraseña"><Input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="••••••••"/></Field>
          {error&&<div style={{color:"#ef4444",fontSize:12,fontFamily:"DM Sans,sans-serif",textAlign:"center"}}>{error}</div>}
          <Btn full disabled={loading} onClick={ingresar}>{loading?"Ingresando…":"Ingresar"}</Btn>
        </div>
      </Card>
    </div>
  </div>;
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
const MODULOS = [
  { id:"dashboard",    icon:"◉",  label:"Dashboard"          },
  { id:"ordenes",      icon:"📌", label:"Órdenes de Trabajo" },
  { id:"equipos",      icon:"🏗", label:"Equipos"            },
  { id:"clientes",     icon:"👥", label:"Clientes"           },
  { id:"operatividad", icon:"📊", label:"Operatividad"       },
  { id:"usuarios",     icon:"🔑", label:"Usuarios"           },
  { id:"log",          icon:"📜", label:"Actividad"          },
];

export default function App() {
  const [user,             setUser]             = useState(null);
  const [modulo,           setModulo]           = useState("dashboard");
  const [usuarios,         setUsuarios]         = useState(S_USUARIOS);
  const [clientes,         setClientes]         = useState(S_CLIENTES);
  const [equipos,          setEquipos]          = useState(S_EQUIPOS);
  const [ordenesTrabajos,  setOrdenesTrabajo]   = useState(S_OT);
  const [log,              setLog]              = useState(S_LOG);
  const [tiposEquipo,      setTiposEquipo]      = useState(TIPOS_EQUIPO_SEED);
  const [modelosPorTipo,   setModelosPorTipo]   = useState({});
  const [estadosEquipo,    setEstadosEquipo]    = useState(ESTADOS_SEED);
  const [notificaciones,   setNotificaciones]   = useState(S_NOTIF);
  const [etiquetasCliente, setEtiquetasCliente] = useState(S_ETIQUETAS_CLIENTE);
  const [menuOpen,         setMenuOpen]         = useState(false);

  const [loaded, setLoaded] = useState(!supabase);
  const [authChecked, setAuthChecked] = useState(!supabase);
  const hydrating = useRef(false);
  const hydratedConUsuario = useRef(false);

  async function cargarPerfil(session) {
    if (!session) { setUser(null); return; }
    const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (error) { console.error("Error cargando perfil:", error); setUser(null); return; }
    if (!profile || profile.activo === false) { setUser(null); return; }
    setUser({ id: profile.id, nombre: profile.nombre || profile.email || session.user.email, usuario: profile.email || session.user.email, rol: profile.rol || "tecnico" });
  }

  async function cargarUsuarios() {
    if (!supabase) return;
    const { data, error } = await supabase.from("profiles").select("*").order("nombre");
    if (error) { console.error("Error cargando usuarios:", error); return; }
    setUsuarios((data||[]).map(p=>({ id:p.id, nombre:p.nombre||p.email, usuario:p.email, rol:p.rol, activo:p.activo })));
  }

  useEffect(() => {
    if (!supabase) { setAuthChecked(true); return; }
    // Importante: hay que esperar a que cargarPerfil termine (con await) antes de marcar
    // authChecked=true. Si no, hay una fracción de segundo donde "ya sabemos que no hay
    // que mostrar el login" pero "user" todavía es null, y en ese instante el resto de la
    // app puede pensar que no hay datos y sobreescribir lo guardado con datos vacíos.
    (async () => {
      const { data } = await supabase.auth.getSession();
      await cargarPerfil(data.session);
      setAuthChecked(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => { cargarPerfil(session); });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (user) cargarUsuarios(); }, [user?.id]);

  useEffect(() => {
    // Importante: esta carga tiene que esperar a que haya una sesión confirmada.
    // Si se dispara antes de eso, la base de datos bloquea la lectura (por seguridad,
    // solo usuarios autenticados pueden leerla) y la app se queda con datos vacíos
    // para siempre, porque este efecto no se vuelve a ejecutar solo.
    if (!supabase) { setLoaded(true); return; }
    if (!authChecked) return;
    if (!user) { setLoaded(true); return; }
    setLoaded(false);
    (async () => {
      hydrating.current = true;
      const { data, error } = await supabase.from(STATE_TABLE).select("data").eq("id", STATE_ROW_ID).maybeSingle();
      if (error) console.error("Error cargando de Supabase:", error);
      if (data && data.data) {
        const s = data.data;
        if (s.clientes) setClientes(s.clientes);
        if (s.equipos) setEquipos(s.equipos);
        if (s.ordenesTrabajos) setOrdenesTrabajo(s.ordenesTrabajos);
        if (s.log) setLog(s.log);
        if (s.tiposEquipo) setTiposEquipo(s.tiposEquipo);
        if (s.modelosPorTipo) setModelosPorTipo(s.modelosPorTipo);
        if (s.estadosEquipo) setEstadosEquipo(s.estadosEquipo);
        if (s.notificaciones) setNotificaciones(s.notificaciones);
        if (s.etiquetasCliente) setEtiquetasCliente(s.etiquetasCliente);
      }
      hydrating.current = false;
      hydratedConUsuario.current = true;
      setLoaded(true);
    })();
  }, [authChecked, user?.id]);

  useEffect(() => {
    if (!supabase || !loaded || hydrating.current || !hydratedConUsuario.current) return;
    const t = setTimeout(() => {
      supabase.from(STATE_TABLE).upsert({
        id: STATE_ROW_ID,
        data: { clientes, equipos, ordenesTrabajos, log, tiposEquipo, modelosPorTipo, estadosEquipo, notificaciones, etiquetasCliente },
        updated_at: new Date().toISOString(),
      }).then(({ error }) => { if (error) console.error("Error guardando en Supabase:", error); });
    }, 600);
    return () => clearTimeout(t);
  }, [clientes, equipos, ordenesTrabajos, log, tiposEquipo, modelosPorTipo, estadosEquipo, notificaciones, etiquetasCliente, loaded]);

  function addLog(accion,detalle=""){setLog(prev=>[...prev,{id:uid(),usuarioId:user?.id,accion,detalle,fecha:new Date().toISOString()}]);}
  async function handleLogout(){addLog("Logout");if(supabase)await supabase.auth.signOut();setUser(null);}

  const otCount = ordenesTrabajos.filter(o=>o.estado==="abierta"&&(user?.rol==="admin"||o.tecnicoId===user?.id)).length;
  const notifCount = user?(notificaciones[user.id]||[]).filter(n=>!n.visto).length:0;

  if (!authChecked) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"#64748b",fontFamily:"DM Sans,sans-serif",background:"#070d1a"}}>Cargando…</div>;
  if (!user) return <Login/>;
  if (!loaded) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"#64748b",fontFamily:"DM Sans,sans-serif",background:"#070d1a"}}>Cargando…</div>;

  const ctx = { user, usuarios, setUsuarios, clientes, setClientes, equipos, setEquipos, ordenesTrabajos, setOrdenesTrabajo, log, addLog, tiposEquipo, setTiposEquipo, modelosPorTipo, setModelosPorTipo, estadosEquipo, setEstadosEquipo, notificaciones, setNotificaciones, etiquetasCliente, setEtiquetasCliente };

  const vista = {
    dashboard:    <Dashboard    setModulo={setModulo}/>,
    ordenes:      <OrdenesTrabajo setModulo={setModulo}/>,
    equipos:      <Equipos      setModulo={setModulo}/>,
    clientes:     <Clientes     setModulo={setModulo}/>,
    operatividad: <Operatividad setModulo={setModulo}/>,
    usuarios:     <Usuarios     setModulo={setModulo}/>,
    log:          <LogActividad setModulo={setModulo}/>,
  }[modulo];

  const NavBtn = ({m}) => {
    const hasAlert = m.id==="ordenes"&&(notifCount>0||otCount>0);
    return <button onClick={()=>{setModulo(m.id);setMenuOpen(false);}}
      style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",borderRadius:8,border:"none",background:modulo===m.id?"#f9731618":"transparent",color:modulo===m.id?"#f97316":"#64748b",cursor:"pointer",fontSize:13,fontFamily:"DM Sans,sans-serif",fontWeight:modulo===m.id?700:500,textAlign:"left",width:"100%",marginBottom:3}}>
      <span style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:14}}>{m.icon}</span>{m.label}</span>
      {hasAlert&&<span style={{display:"flex",alignItems:"center",gap:4}}>
        {notifCount>0&&<span style={{background:"#ef4444",borderRadius:"50%",width:8,height:8,display:"inline-block"}}/>}
        {otCount>0&&<span style={{background:"#ef4444",color:"#fff",borderRadius:20,fontSize:10,fontWeight:700,padding:"1px 6px"}}>{otCount}</span>}
      </span>}
    </button>;
  };

  return <AppCtx.Provider value={ctx}>
    <style>{`${fonts}*{box-sizing:border-box;margin:0;padding:0;}body{background:#070d1a;color:#e2e8f0;height:100vh;overflow:hidden;}#root{height:100vh;display:flex;flex-direction:column;}::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:#070d1a;}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:3px;}input:focus,select:focus,textarea:focus{border-color:#f97316!important;box-shadow:0 0 0 2px #f9731622;}@media(max-width:900px){.sd{display:none!important;}.mb{display:flex!important;}main{padding-top:60px!important;padding-left:14px!important;padding-right:14px!important;overflow-y:auto!important;height:calc(100vh - 60px)!important;}}@media(min-width:901px){.mb{display:none!important;}}`}</style>
    <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>
      {/* SIDEBAR */}
      <aside className="sd" style={{width:220,background:"#0a1120",borderRight:"1px solid #1e293b",display:"flex",flexDirection:"column",padding:"20px 0",flexShrink:0,height:"100vh"}}>
        <div style={{padding:"0 18px 20px",borderBottom:"1px solid #1e293b",marginBottom:12}}>
          <div style={{fontFamily:"Syne,sans-serif",fontSize:17,fontWeight:800,color:"#f97316"}}>⚙️ TallerPro</div>
        </div>
        <nav style={{flex:1,padding:"0 10px",overflowY:"auto"}}>{MODULOS.map(m=><NavBtn key={m.id} m={m}/>)}</nav>
        <div style={{padding:"16px 18px",borderTop:"1px solid #1e293b"}}>
          <div style={{fontFamily:"DM Sans,sans-serif",fontSize:12,color:"#64748b",marginBottom:8}}><span style={{color:"#f97316",fontWeight:700}}>@{user.usuario}</span> · {ROLES[user.rol]}</div>
          <Btn variant="secondary" sm full onClick={handleLogout}>Cerrar sesión</Btn>
        </div>
      </aside>

      {/* MOBILE BAR */}
      <div className="mb" style={{display:"none",position:"fixed",top:0,left:0,right:0,zIndex:100,background:"#0a1120",borderBottom:"1px solid #1e293b",padding:"10px 16px",alignItems:"center",justifyContent:"space-between",height:60}}>
        <span style={{fontFamily:"Syne,sans-serif",fontSize:15,fontWeight:800,color:"#f97316"}}>⚙️ TallerPro</span>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {notifCount>0&&<span style={{background:"#ef4444",borderRadius:"50%",width:10,height:10,display:"inline-block"}}/>}
          {otCount>0&&<span style={{background:"#ef4444",color:"#fff",borderRadius:20,fontSize:11,fontWeight:700,padding:"2px 8px"}}>{otCount} OT</span>}
          <button onClick={()=>setMenuOpen(!menuOpen)} style={{background:"none",border:"none",color:"#94a3b8",fontSize:22,cursor:"pointer"}}>☰</button>
        </div>
      </div>

      {menuOpen&&<div style={{position:"fixed",inset:0,zIndex:150,background:"#070d1aee"}} onClick={()=>setMenuOpen(false)}>
        <div style={{background:"#0a1120",width:240,height:"100%",padding:"60px 10px 20px",display:"flex",flexDirection:"column",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
          {MODULOS.map(m=><NavBtn key={m.id} m={m}/>)}
          <div style={{marginTop:"auto",padding:"12px 0",borderTop:"1px solid #1e293b"}}>
            <div style={{fontFamily:"DM Sans,sans-serif",fontSize:12,color:"#64748b",marginBottom:8}}>@{user.usuario} · {ROLES[user.rol]}</div>
            <Btn variant="secondary" sm onClick={handleLogout}>Cerrar sesión</Btn>
          </div>
        </div>
      </div>}

      {/* MAIN */}
      <main style={{flex:1,padding:"24px 28px",overflowY:"auto",height:"100vh",display:"flex",flexDirection:"column"}}>
        {vista}
      </main>
    </div>
  </AppCtx.Provider>;
}
