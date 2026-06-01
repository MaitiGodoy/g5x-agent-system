const fs = require('fs');
const babel = require('@babel/core');

console.log('Restoring from backup...');
fs.copyFileSync('public/index.dev.html.bak', 'public/index.dev.html');

let html = fs.readFileSync('public/index.dev.html', 'utf8');

// Normalize line endings to LF
html = html.replace(/\r\n/g, '\n');

// Fix 1: style bracket in ObPipeline
console.log('Fixing style bracket in ObPipeline...');
html = html.replace(
  `  <div style={{maxHeight:'calc(100vh - 220px)',overflowY:'auto'}>`,
  `  <div style={{maxHeight:'calc(100vh - 220px)',overflowY:'auto'}}>`
);

// Fix 2: map close in ObPipeline
console.log('Fixing map close in ObPipeline...');
// The line is: " )}" followed by " </div>\n );"
html = html.replace(
  ' )}\n </div>\n );\n\n// PARTE 7b — GELADEIRA',
  ' ))}\n </div>\n );\n\n// PARTE 7b — GELADEIRA'
);

// 3. Declare stateRef and chatSending state
console.log('Adding stateRef and chatSending states...');
html = html.replace(
  '  const [chatHistory,setChatHistory]=useState([]);\n  const chatInputRef=useRef(null);',
  '  const [chatHistory,setChatHistory]=useState([]);\n  const [chatSending,setChatSending]=useState(false);\n  const chatInputRef=useRef(null);\n  const stateRef=useRef(null);'
);

// 4. Define handleObLeadDrop after moveLead
console.log('Adding handleObLeadDrop...');
html = html.replace(
  '  const moveLead=async(id,status)=>{\n   await B.moveLeadStage(id,status);\n   await loadData();\n  };',
  `  const moveLead=async(id,status)=>{\n   await B.moveLeadStage(id,status);\n   await loadData();\n  };\n\n  const handleObLeadDrop = async (leadId, targetStageId) => {\n    try {\n      const lead = obLeads.find(l => l.id === leadId);\n      if (!lead) return;\n      let updateData = {};\n      if (targetStageId === 'fila') {\n        updateData = { status: 'fila', paused: false };\n      } else if (targetStageId.startsWith('step_')) {\n        const stepNum = parseInt(targetStageId.split('_')[1], 10);\n        updateData = { status: 'execucao', cadencia_step: stepNum, paused: false };\n      } else if (targetStageId === 'objecao') {\n        updateData = { status: 'objecao', paused: false };\n      } else if (targetStageId === 'resposto') {\n        await B.replyObLead(leadId);\n        await loadData();\n        return;\n      } else if (targetStageId === 'pausado') {\n        updateData = { paused: true };\n      }\n      await B.updateObLead(leadId, updateData);\n      await loadData();\n    } catch (err) {\n      console.error('Erro ao mover lead outbound:', err);\n    }\n  };`
);

// 5. Update sendChat to use chatSending state
console.log('Updating sendChat...');
html = html.replace(
  `  const sendChat=async()=>{\n  const el=chatInputRef.current;\n  if(!el||!el.value.trim())return;\n  const msg=el.value.trim();\n  el.value='';\n  el.focus();\n  setChatHistory(prev=>[...prev,{id:Date.now().toString(),role:'user',content:msg,ts:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}]);\n  try{\n  const response=await B.sendChatMessage(msg);\n  if(response)setChatHistory(prev=>[...prev,response]);\n  }catch(e){\n  setChatHistory(prev=>[...prev,{id:Date.now().toString(),role:'agent',content:'❌ Erro de conexão com a IA. Verifique o servidor.',ts:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}]);\n  }\n  setTimeout(()=>{\n  if(chatEndRef.current)chatEndRef.current.scrollIntoView({behavior:'smooth'});\n  },100);\n };`,
  `  const sendChat=async()=>{\n  const el=chatInputRef.current;\n  if(!el||!el.value.trim()||chatSending)return;\n  const msg=el.value.trim();\n  el.value='';\n  el.focus();\n  setChatSending(true);\n  setChatHistory(prev=>[...prev,{id:Date.now().toString(),role:'user',content:msg,ts:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}]);\n  try{\n  const response=await B.sendChatMessage(msg);\n  if(response)setChatHistory(prev=>[...prev,response]);\n  }catch(e){\n  setChatHistory(prev=>[...prev,{id:Date.now().toString(),role:'agent',content:'❌ Erro de conexão com a IA. Verifique o servidor.',ts:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}]);\n  }finally{\n  setChatSending(false);\n  setTimeout(()=>{\n  if(chatEndRef.current)chatEndRef.current.scrollIntoView({behavior:'smooth'});\n  },100);\n  }\n };`
);

// 6. Update stats to depend on chatHistory and view for chat auto-scrolling
console.log('Adding chat scroll and engine polling useEffects at App level...');
html = html.replace(
  ' // Auto-refresh a cada 30s\n useEffect(()=>{\n  const iv=setInterval(loadData,30000);\n  return()=>clearInterval(iv);\n },[loadData]);',
  ' // Auto-refresh a cada 30s\n useEffect(()=>{\n  const iv=setInterval(loadData,30000);\n  return()=>clearInterval(iv);\n },[loadData]);\n\n  // Rolagem automática do chat\n  useEffect(() => {\n    if (view === \'chat\' && chatEndRef.current) {\n      chatEndRef.current.scrollIntoView({\n        behavior: \'smooth\'\n      });\n    }\n  }, [chatHistory, view]);\n\n  // Polling de status do motor quando ativo na visualização do agente\n  useEffect(() => {\n    if (view === \'agent\' && agentSubView === \'engine\') {\n      fetchEngineStatus();\n      const iv = setInterval(fetchEngineStatus, 10000);\n      return () => clearInterval(iv);\n    }\n  }, [view, agentSubView]);'
);

// 7. Populate stateRef.current right before contextValue
console.log('Injecting stateRef assignment...');
html = html.replace(
  '  const contextValue = {\n    view, setView,',
  '  stateRef.current = {\n    view, setView,\n    partners, setPartners,\n    leads, setLeads,\n    actions, setActions,\n    stages, setStages,\n    obLeads, setObLeads,\n    obGeladeira, setObGeladeira,\n    cadences, setCadences,\n    agentConfig, setAgentConfig,\n    knowledge, setKnowledge,\n    chatHistory, setChatHistory,\n    activityLog, setActivityLog,\n    agentLog, setAgentLog,\n    dashboard, setDashboard,\n    indicacoes, setIndicacoes,\n    loading, setLoading,\n    pFilter, setPFilter,\n    search, setSearch,\n    modal, setModal,\n    obSubView, setObSubView,\n    agentSubView, setAgentSubView,\n    knowledgeSubView, setKnowledgeSubView,\n    editingCadence, setEditingCadence,\n    contentRef, sidebarRef, chatEndRef, chatInputRef,\n    loadData, setupGrabScroll, gsContent, gsSidebar,\n    openWA, saveLead, deleteLead, moveLead, savePartner, deletePartner,\n    saveTask, toggleTask, addToOutbound, moveObLead, togglePauseOb,\n    reactivateFromGeladeira, discardFromGeladeira, saveCadence, deleteCadence,\n    duplicateCadence, sendChat, importLeadFile, uploadKnowledgeFile,\n    addKnowledgeUrl, saveFaq, saveObjection, saveText, saveAgentConfig,\n    stats, filteredLeads,\n    G5X_STAGES, OB_STAGES, ORIGEM_INDICACAO, B, fmtDate, chatSending, setChatSending, fetchEngineStatus, engineStatus, engineLogs, setEngineStatus, setEngineLogs, handleObLeadDrop\n  };\n\n  const contextValue = {\n    view, setView,'
);

// 8. Replace KanbanColumn with the memoized version
console.log('Memoizing KanbanColumn...');
const oldColumnText = `const KanbanColumn=({stage,leadsList,onDrop})=>{
  const {leads,setModal}=React.useContext(AppContext);
  const[dragOver,setDragOver]=useState(false);
  const handleDragOver=e=>{e.preventDefault();setDragOver(true)};
  const handleDragLeave=()=>setDragOver(false);
  const handleDrop=e=>{
    e.preventDefault();setDragOver(false);
    const leadId=e.dataTransfer.getData('text/plain');
    const lead=leads.find(l=>l.id===leadId);
    if(lead&&lead.status!==stage.id){
      const info=getRotaInfo(lead);
      const stageInfo=G5X_STAGES.find(s=>s.id===stage.id);
      const camposNeeded=[];
      if(stage.id==='viabilidade_tecnica')camposNeeded.push('Anexar Balanço Patrimonial');
      if(stage.id==='diagnostico_agendado')camposNeeded.push('Data da Call de 15min');
      if(stage.id==='apresentacao_teto')camposNeeded.push('Teto de até 5x faturamento');
      if(stage.id==='diligencia_matriz')camposNeeded.push('Montar Pasta Técnica');
      if(stage.id==='credito_na_tela')camposNeeded.push('Honorários no Êxito');
      const msg=camposNeeded.length?\`Campos para \${stageInfo.title}: \${camposNeeded.join(', ')}\`:'';
      setModal({type:'stageMove',data:{lead,newStage:stage.id,stageInfo,camposNeeded,msg}});
    }
  };
  return(
    <div className={\`kanban-column \${dragOver?'drop-target':''}\`}
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      style={{minWidth:260,maxWidth:300,flex:1,padding:10,transition:'all .15s'}}>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10,padding:'0 4px'}}>
        <div style={{width:8,height:8,borderRadius:'50%',background:stage.color}}/>
        <div style={{fontWeight:600,fontSize:12,color:'var(--text-primary)'}}>{stage.title}</div>
        <div style={{marginLeft:'auto',fontSize:11,color:'var(--text-muted)',background:'rgba(255,255,255,.04)',padding:'1px 7px',borderRadius:6}}>{leadsList.length}</div>
      </div>
      <div style={{maxHeight:'calc(100vh - 180px)',overflowY:'auto',minHeight:60}}>
        {leadsList.map(l=>(
          <div key={l.id} draggable
            onDragStart={e=>e.dataTransfer.setData('text/plain',l.id)}
            style={{cursor:'grab'}}>
            <LeadCard lead={l}/>
          </div>
        ))}
        {leadsList.length===0&&<div style={{textAlign:'center',color:'var(--border)',fontSize:12,padding:16}}>Vazio</div>}
      </div>
    </div>
  );
};`;

const newColumnText = `const KanbanColumn = useMemo(() => {
  return ({stage,leadsList,onDrop})=>{
    const { leads, setModal, B, G5X_STAGES, setLeads } = stateRef.current;
    const[dragOver,setDragOver]=useState(false);
    const handleDragOver=e=>{e.preventDefault();setDragOver(true)};
    const handleDragLeave=()=>setDragOver(false);
    const handleDrop=e=>{
      e.preventDefault();setDragOver(false);
      const leadId=e.dataTransfer.getData('text/plain');
      const lead=leads.find(l=>l.id===leadId);
      if(lead&&lead.status!==stage.id){
        const info=getRotaInfo(lead);
        const stageInfo=G5X_STAGES.find(s=>s.id===stage.id);
        const camposNeeded=[];
        if(stage.id==='viabilidade_tecnica')camposNeeded.push('Anexar Balanço Patrimonial');
        if(stage.id==='diagnostico_agendado')camposNeeded.push('Data da Call de 15min');
        if(stage.id==='apresentacao_teto')camposNeeded.push('Teto de até 5x faturamento');
        if(stage.id==='diligencia_matriz')camposNeeded.push('Montar Pasta Técnica');
        if(stage.id==='credito_na_tela')camposNeeded.push('Honorários no Êxito');
        const msg=camposNeeded.length?\`Campos para \${stageInfo.title}: \${camposNeeded.join(', ')}\`:'';
        setModal({type:'stageMove',data:{lead,newStage:stage.id,stageInfo,camposNeeded,msg}});
      }
    };
    return(
      <div className={\`kanban-column \${dragOver?'drop-target':''}\`}
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        style={{minWidth:260,maxWidth:300,flex:1,padding:10,transition:'all .15s'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10,padding:'0 4px'}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:stage.color}}/>
          <div style={{fontWeight:600,fontSize:12,color:'var(--text-primary)'}}>{stage.title}</div>
          <div style={{marginLeft:'auto',fontSize:11,color:'var(--text-muted)',background:'rgba(255,255,255,.04)',padding:'1px 7px',borderRadius:6}}>{leadsList.length}</div>
        </div>
        <div style={{maxHeight:'calc(100vh - 180px)',overflowY:'auto',minHeight:60}}>
          {leadsList.map(l=>(
            <div key={l.id} draggable
              onDragStart={e=>e.dataTransfer.setData('text/plain',l.id)}
              style={{cursor:'grab'}}>
              <LeadCard lead={l}/>
            </div>
          ))}
          {leadsList.length===0&&<div style={{textAlign:'center',color:'var(--border)',fontSize:12,padding:16}}>Vazio</div>}
        </div>
      </div>
    );
  };
}, []);`;

if (html.includes(oldColumnText)) {
  html = html.replace(oldColumnText, newColumnText);
} else {
  console.log('⚠️ oldColumnText not found exactly!');
}

// 9. Update ObCard for Draggable support
console.log('Updating ObCard for drag-and-drop...');
const oldObCard = `const ObCard=({ol})=>{\n const {setModal}=React.useContext(AppContext);\n return (\n <div className="ob-card" onClick={()=>setModal({type:'obDetail',data:ol})}\n style={{background:'var(--graphite)',borderRadius:8,padding:10,marginBottom:5,borderLeftColor:OB_STAGES.find(s=>s.id===ol.status)?.color||'var(--border)'}}>`;

const newObCard = `const ObCard=({ol})=>{\n const {setModal, OB_STAGES, fmtDate}=stateRef.current;\n const handleDragStart = e => {\n   e.dataTransfer.setData('text/plain', ol.id);\n };\n return (\n <div className="ob-card" \n draggable\n onDragStart={handleDragStart}\n onClick={()=>setModal({type:'obDetail',data:ol})}\n style={{background:'var(--graphite)',borderRadius:8,padding:10,marginBottom:5,borderLeftColor:OB_STAGES.find(s=>s.id===ol.status)?.color||'var(--border)', cursor: 'grab'}}>`;

html = html.replace(oldObCard, newObCard);

// 10. Update ObPipeline to dynamic columns and drag-and-drop support
console.log('Updating ObPipeline...');
const oldObPipeline = `const ObPipeline=()=>{\n const {contentRef,gsContent,obLeads}=React.useContext(AppContext);\n return (\n <div className="grab-scroll" ref={contentRef} onMouseDown={gsContent.onMouseDown} onMouseMove={gsContent.onMouseMove}\n onMouseUp={gsContent.onMouseUp} onMouseLeave={gsContent.onMouseLeave}\n style={{display:'flex',gap:12,padding:'16px 24px',overflowX:'auto',overflowY:'hidden',flex:1}}>\n {OB_STAGES.map(s=>(\n <div key={s.id} className="kanban-column" style={{minWidth:240,flex:1,padding:12}}>\n <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>\n <div style={{width:10,height:10,borderRadius:'50%',background:s.color}}/>\n <div style={{fontWeight:700,fontSize:13,color:'white'}}>{s.title}</div>\n <div style={{marginLeft:'auto',fontSize:12,color:'#8b949e'}}>{obLeads.filter(l=>l.status===s.id).length}</div>\n </div>\n <div style={{maxHeight:'calc(100vh - 220px)',overflowY:'auto'}}>\n {obLeads.filter(l=>l.status===s.id).map(l=><ObCard key={l.id} ol={l}/>)}\n </div>\n </div>\n ))}\n </div>\n);};`;

const newObPipeline = `const ObPipelineColumn = ({ stage, leadsList, onDrop }) => {\n  const { setModal } = stateRef.current;\n  const [dragOver, setDragOver] = useState(false);\n  const handleDragOver = e => {\n    e.preventDefault();\n    setDragOver(true);\n  };\n  const handleDragLeave = () => setDragOver(false);\n  const handleDrop = e => {\n    e.preventDefault();\n    setDragOver(false);\n    const leadId = e.dataTransfer.getData('text/plain');\n    onDrop(leadId, stage.id);\n  };\n\n  return (\n    <div \n      className={\`kanban-column \${dragOver ? 'drop-target' : ''}\`}\n      onDragOver={handleDragOver} \n      onDragLeave={handleDragLeave} \n      onDrop={handleDrop}\n      style={{minWidth:240, flex:1, padding:12, transition:'all .15s'}}\n    >\n      <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:12}}>\n        <div style={{width:10, height:10, borderRadius:'50%', background:stage.color}}/>\n        <div style={{fontWeight:700, fontSize:13, color:'white'}}>{stage.title}</div>\n        <div style={{marginLeft:'auto', fontSize:12, color:'#8b949e'}}>{leadsList.length}</div>\n      </div>\n      <div style={{maxHeight:'calc(100vh - 220px)', overflowY:'auto'}}>\n        {leadsList.map(l => <ObCard key={l.id} ol={l}/>)}\n        {leadsList.length === 0 && <div style={{textAlign:'center', color:'var(--border)', fontSize:12, padding:16}}>Vazio</div>}\n      </div>\n    </div>\n  );\n};\n\nconst ObPipeline=()=>{\n  const {contentRef, gsContent, obLeads, cadences, handleObLeadDrop}=stateRef.current;\n  const activeCadence = cadences.find(c => c.status === 'Ativa');\n  let obStages = [];\n\n  if (activeCadence && activeCadence.cadence_steps && activeCadence.cadence_steps.length > 0) {\n    obStages.push({ id: 'fila', title: 'Fila', color: '#8b949e', filter: l => l.status === 'fila' && !l.paused });\n    const colors = ['#3b82f6', '#d29922', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4'];\n    activeCadence.cadence_steps.forEach((step, idx) => {\n      const stepNum = step.step_number;\n      obStages.push({\n        id: \`step_\${stepNum}\`,\n        title: \`Passo \${stepNum} (\${step.channel})\`,\n        color: colors[idx % colors.length],\n        filter: l => l.status !== \'fila\' && l.status !== \'objecao\' && l.status !== \'resposto\' && l.status !== \'convertido\' && l.status !== \'descartado\' && l.cadencia_step === stepNum && !l.paused\n      });\n    });\n    obStages.push({ id: 'objecao', title: 'Objeção', color: '#ef4444', filter: l => l.status === 'objecao' && !l.paused });\n    obStages.push({ id: 'resposto', title: 'Resposto / Convertido', color: '#10b981', filter: l => (l.status === 'resposto' || l.status === 'convertido') && !l.paused });\n    obStages.push({ id: 'pausado', title: 'Pausados / Congelados', color: '#6e7681', filter: l => l.paused || l.status === 'descartado' });\n  } else {\n    obStages = [\n      { id: 'fila', title: 'Fila', color: '#8b949e', filter: l => l.status === 'fila' },\n      { id: 'ativo', title: 'Em Execução', color: '#3b82f6', filter: l => l.status !== 'fila' && l.status !== 'objecao' && l.status !== 'resposto' && l.status !== 'convertido' && l.status !== 'descartado' && !l.paused },\n      { id: 'objecao', title: 'Objeção', color: '#ef4444', filter: l => l.status === 'objecao' },\n      { id: 'resposto', title: 'Respostos', color: '#10b981', filter: l => l.status === 'resposto' || l.status === 'convertido' },\n      { id: 'pausado', title: 'Pausados', color: '#6e7681', filter: l => l.paused || l.status === 'descartado' }\n    ];\n  }\n\n  return (\n    <div className="grab-scroll" ref={contentRef} onMouseDown={gsContent.onMouseDown} onMouseMove={gsContent.onMouseMove}\n      onMouseUp={gsContent.onMouseUp} onMouseLeave={gsContent.onMouseLeave}\n      style={{display:\'flex\', gap:12, padding:\'16px 24px\', overflowX:\'auto\', overflowY:\'hidden\', flex:1}}>\n      {obStages.map(s => (\n        <ObPipelineColumn \n          key={s.id} \n          stage={s} \n          leadsList={obLeads.filter(s.filter)} \n          onDrop={handleObLeadDrop}\n        />\n      ))}\n    </div>\n  );\n};`;

html = html.replace(oldObPipeline, newObPipeline);

// 11. Add simulateReply and manualMigrate to ObDetailModal
console.log('11. Adding simulateReply and manualMigrate to ObDetailModal...');
const oldObDetailModal = `const ObDetailModal=({ol})=>{\n const {setModal,togglePauseOb}=React.useContext(AppContext);\n const[history,setHistory]=useState([]);\n const[commLog,setCommLog]=useState([]);\n const[loading,setLoading]=useState(true);\n const[replyMsg,setReplyMsg]=useState('');\n const[replyChannel,setReplyChannel]=useState(ol.channel||'whatsapp');\n\n useEffect(()=>{\n const load=async()=>{\n const[hist,comm]=await Promise.all([\n B.getObHistory(ol.id),\n B.getCommLog({ob_lead_id:ol.id})\n ]);\n setHistory(hist||[]);\n setCommLog(comm||[]);\n setLoading(false);\n };\n load();\n },[ol.id]);\n\n const sendReply=async()=>{\n if(!replyMsg.trim())return;\n await B.sendMessage({\n channel:replyChannel,ob_lead_id:ol.id,\n phone:ol.phone,email:ol.email,message:replyMsg,\n subject:\`Re: \${ol.company||'Proposta'}\`\n });\n setReplyMsg('');\n const[hist,comm]=await Promise.all([B.getObHistory(ol.id),B.getCommLog({ob_lead_id:ol.id})]);\n setHistory(hist||[]);\n setCommLog(comm||[]);\n };\n\n return(\n <Modal onClose={()=>setModal({type:null})}>\n <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>\n <div style={{width:40,height:40,borderRadius:10,background:'var(--amber)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,color:'black',fontSize:16}}>\n {ol.name?.charAt(0)||'?'}\n </div>\n <div>\n <div style={{fontWeight:800,color:'white',fontSize:18}}>{ol.name}</div>\n <div style={{fontSize:12,color:'#8b949e'}}>{ol.company||'—'} • Passo {ol.cadencia_step||'—'}</div>\n </div>\n <div style={{marginLeft:'auto',display:'flex',gap:6}}>\n <button onClick={()=>togglePauseOb(ol.id,ol.paused)}\n style={{background:ol.paused?'rgba(63,185,80,.15)':'rgba(168,85,247,.15)',color:ol.paused?'#3fb950':'var(--zombie)',border:'none',padding:'6px 10px',borderRadius:8,fontSize:12,cursor:'pointer'}}>\n {ol.paused?'Retomar':'Pausar'}\n </button>\n </div>\n </div>`;

const newObDetailModal = `const ObDetailModal=({ol})=>{\n const {setModal,togglePauseOb}=stateRef.current;\n const[history,setHistory]=useState([]);\n const[commLog,setCommLog]=useState([]);\n const[loading,setLoading]=useState(true);\n const[replyMsg,setReplyMsg]=useState('');\n const[replyChannel,setReplyChannel]=useState(ol.channel||'whatsapp');\n\n const loadDataObj = async()=>{\n const[hist,comm]=await Promise.all([\n B.getObHistory(ol.id),\n B.getCommLog({ob_lead_id:ol.id})\n ]);\n setHistory(hist||[]);\n setCommLog(comm||[]);\n setLoading(false);\n };\n\n useEffect(()=>{\n loadDataObj();\n },[ol.id]);\n\n const sendReply=async()=>{\n if(!replyMsg.trim())return;\n await B.sendMessage({\n channel:replyChannel,ob_lead_id:ol.id,\n phone:ol.phone,email:ol.email,message:replyMsg,\n subject:\`Re: \${ol.company||'Proposta'}\`\n });\n setReplyMsg('');\n const[hist,comm]=await Promise.all([B.getObHistory(ol.id),B.getCommLog({ob_lead_id:ol.id})]);\n setHistory(hist||[]);\n setCommLog(comm||[]);\n };\n\n const simulateReply = async () => {\n   setLoading(true);\n   await B.replyObLead(ol.id);\n   await stateRef.current.loadData();\n   setModal({ type: null });\n };\n\n const manualMigrate = async () => {\n   setLoading(true);\n   await B.migrateObLead(ol.id);\n   await stateRef.current.loadData();\n   setModal({ type: null });\n };\n\n return(\n <Modal onClose={()=>setModal({type:null})}>\n <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>\n <div style={{width:40,height:40,borderRadius:10,background:'var(--amber)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,color:'black',fontSize:16}}>\n {ol.name?.charAt(0)||'?'}\n </div>\n <div>\n <div style={{fontWeight:800,color:'white',fontSize:18}}>{ol.name}</div>\n <div style={{fontSize:12,color:'#8b949e'}}>{ol.company||'—'} • Passo {ol.cadencia_step||'—'}</div>\n </div>\n <div style={{marginLeft:'auto',display:'flex',gap:6}}>\n <button onClick={()=>togglePauseOb(ol.id,ol.paused)}\n style={{background:ol.paused?'rgba(63,185,80,.15)':'rgba(168,85,247,.15)',color:ol.paused?'#3fb950':'var(--zombie)',border:'none',padding:'6px 10px',borderRadius:8,fontSize:12,cursor:'pointer'}}>\n {ol.paused?'Retomar':'Pausar'}\n </button>\n <button onClick={simulateReply} style={{background:\'rgba(16,185,129,.15)\',color:\'#10b981\',border:\'none\',padding:\'6px 10px\',borderRadius:8,fontSize:12,cursor:\'pointer\'}}>Simular Resp.</button>\n <button onClick={manualMigrate} style={{background:\'rgba(59,130,246,.15)\',color:\'#3b82f6\',border:\'none\',padding:\'6px 10px\',borderRadius:8,fontSize:12,cursor:\'pointer\'}}>Mover p/ CRM</button>\n </div>\n </div>`;

html = html.replace(oldObDetailModal, newObDetailModal);

// 12. Update OutboundView tabs to include Pipeline Outbound
console.log('12. Updating OutboundView tabs...');
const oldOutboundView = `const OutboundView=()=>{\n const {obSubView,setObSubView,cadences,obLeads,obGeladeira,agentConfig}=React.useContext(AppContext);\n const tabs=[\n   {id:'cadences',label:'Cadências',icon:'step'},\n   {id:'geladeira',label:'Geladeira',icon:'ac_unit'},\n   {id:'config',label:'Config Operacional',icon:'settings'}\n  ];\n return(\n <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>\n <div style={{display:'flex',gap:4,padding:'12px 24px 0',borderBottom:'1px solid var(--border)'}}>\n {tabs.map(t=>(\n <button key={t.id} onClick={()=>setObSubView(t.id)} style={{\n padding:'8px 16px',border:'none',background:'transparent',cursor:'pointer',\n color:obSubView===t.id?\'var(--gold)\':\'#8b949e\',fontWeight:obSubView===t.id?700:400,\n borderBottom:obSubView===t.id?\'2px solid var(--gold)\':\'2px solid transparent\',fontSize:13\n }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:\'middle\',marginRight:4}}>{t.icon}</span>{t.label}</button>\n ))}\n </div>\n {obSubView===\'cadences\'&&<CadencesView/>}\n {obSubView===\'geladeira\'&&<GeladeiraView/>}`;

const newOutboundView = `const OutboundView=()=>{\n const {obSubView,setObSubView,cadences,obLeads,obGeladeira,agentConfig}=React.useContext(AppContext);\n const tabs=[\n   {id:\'pipeline\',label:\'Pipeline Outbound\',icon:\'view_kanban\'},\n   {id:\'cadences\',label:\'Cadências\',icon:\'step\'},\n   {id:\'geladeira\',label:\'Geladeira\',icon:\'ac_unit\'},\n   {id:\'config\',label:\'Config Operacional\',icon:\'settings\'}\n  ];\n return(\n <div style={{display:\'flex\',flexDirection:\'column\',flex:1,overflow:\'hidden\'}}>\n <div style={{display:\'flex\',gap:4,padding:\'12px 24px 0\',borderBottom:\'1px solid var(--border)\'}}>\n {tabs.map(t=>(\n <button key={t.id} onClick={()=>setObSubView(t.id)} style={{\n padding:\'8px 16px\',border:\'none\',background:\'transparent\',cursor:\'pointer\',\n color:obSubView===t.id?\'var(--gold)\':\'#8b949e\',fontWeight:obSubView===t.id?700:400,\n borderBottom:obSubView===t.id?\'2px solid var(--gold)\':\'2px solid transparent\',fontSize:13\n }}><span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:\'middle\',marginRight:4}}>{t.icon}</span>{t.label}</button>\n ))}\n </div>\n {obSubView===\'pipeline\'&&ObPipeline()}\n {obSubView===\'cadences\'&&<CadencesView/>}\n {obSubView===\'geladeira\'&&<GeladeiraView/>}`;

html = html.replace(oldOutboundView, newOutboundView);

// 13. Set obSubView default to 'pipeline'
console.log('13. Setting obSubView default to pipeline...');
html = html.replace(
  `const[obSubView,setObSubView]=useState('pipeline');`,
  `const[obSubView,setObSubView]=useState('pipeline');` // already 'pipeline'
);

// Convert back to CRLF
html = html.replace(/\n/g, '\r\n');
fs.writeFileSync('public/index.dev.html', html);

// Validate by running babel
const startTag = '<script type="text/babel">';
const startIdx = html.indexOf(startTag) + startTag.length;
const endIdx = html.indexOf('</script>', startIdx);
const jsxCode = html.substring(startIdx, endIdx);

try {
  babel.transformSync(jsxCode, {
    presets: ['@babel/preset-react'],
    filename: 'crm.jsx'
  });
  console.log('🎉 SUCCESS: index.dev.html compiled cleanly with Babel!');
} catch (e) {
  console.error('❌ COMPILE ERROR after merges:');
  console.error(e.message);
}
