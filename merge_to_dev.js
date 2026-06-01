const fs = require('fs');

let html = fs.readFileSync('public/index.dev.html', 'utf8');

// Normalize line endings to LF
html = html.replace(/\r\n/g, '\n');

// 1. Declare stateRef and chatSending state
console.log('1. Adding stateRef and chatSending states...');
html = html.replace(
  '  const [chatHistory,setChatHistory]=useState([]);\n  const chatInputRef=useRef(null);',
  '  const [chatHistory,setChatHistory]=useState([]);\n  const [chatSending,setChatSending]=useState(false);\n  const chatInputRef=useRef(null);\n  const stateRef=useRef(null);'
);

// 2. Define handleObLeadDrop after moveLead
console.log('2. Adding handleObLeadDrop...');
html = html.replace(
  '  const moveLead=async(id,status)=>{\n   await B.moveLeadStage(id,status);\n   await loadData();\n  };',
  '  const moveLead=async(id,status)=>{\n   await B.moveLeadStage(id,status);\n   await loadData();\n  };\n\n  const handleObLeadDrop = async (leadId, targetStageId) => {\n    try {\n      const lead = obLeads.find(l => l.id === leadId);\n      if (!lead) return;\n      let updateData = {};\n      if (targetStageId === \'fila\') {\n        updateData = { status: \'fila\', paused: false };\n      } else if (targetStageId.startsWith(\'step_\')) {\n        const stepNum = parseInt(targetStageId.split(\'_\')[1], 10);\n        updateData = { status: \'execucao\', cadencia_step: stepNum, paused: false };\n      } else if (targetStageId === \'objecao\') {\n        updateData = { status: \'objecao\', paused: false };\n      } else if (targetStageId === \'resposto\') {\n        await B.replyObLead(leadId);\n        await loadData();\n        return;\n      } else if (targetStageId === \'pausado\') {\n        updateData = { paused: true };\n      }\n      await B.updateObLead(leadId, updateData);\n      await loadData();\n    } catch (err) {\n      console.error(\'Erro ao mover lead outbound:\', err);\n    }\n  };'
);

// 3. Update sendChat to use chatSending state
console.log('3. Updating sendChat...');
html = html.replace(
  `  const sendChat=async()=>{\n  const el=chatInputRef.current;\n  if(!el||!el.value.trim())return;\n  const msg=el.value.trim();\n  el.value='';\n  el.focus();\n  setChatHistory(prev=>[...prev,{id:Date.now().toString(),role:'user',content:msg,ts:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}]);\n  try{\n  const response=await B.sendChatMessage(msg);\n  if(response)setChatHistory(prev=>[...prev,response]);\n  }catch(e){\n  setChatHistory(prev=>[...prev,{id:Date.now().toString(),role:'agent',content:'❌ Erro de conexão com a IA. Verifique o servidor.',ts:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}]);\n  }\n  setTimeout(()=>{\n  if(chatEndRef.current)chatEndRef.current.scrollIntoView({behavior:'smooth'});\n  },100);\n };`,
  `  const sendChat=async()=>{\n  const el=chatInputRef.current;\n  if(!el||!el.value.trim()||chatSending)return;\n  const msg=el.value.trim();\n  el.value='';\n  el.focus();\n  setChatSending(true);\n  setChatHistory(prev=>[...prev,{id:Date.now().toString(),role:'user',content:msg,ts:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}]);\n  try{\n  const response=await B.sendChatMessage(msg);\n  if(response)setChatHistory(prev=>[...prev,response]);\n  }catch(e){\n  setChatHistory(prev=>[...prev,{id:Date.now().toString(),role:'agent',content:'❌ Erro de conexão com a IA. Verifique o servidor.',ts:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}]);\n  }finally{\n  setChatSending(false);\n  setTimeout(()=>{\n  if(chatEndRef.current)chatEndRef.current.scrollIntoView({behavior:'smooth'});\n  },100);\n  }\n };`
);

// 4. Update stats to depend on chatHistory and view for chat auto-scrolling
console.log('4. Adding chat scroll and engine polling useEffects at App level...');
html = html.replace(
  ' // Auto-refresh a cada 30s\n useEffect(()=>{\n  const iv=setInterval(loadData,30000);\n  return()=>clearInterval(iv);\n },[loadData]);',
  ' // Auto-refresh a cada 30s\n useEffect(()=>{\n  const iv=setInterval(loadData,30000);\n  return()=>clearInterval(iv);\n },[loadData]);\n\n  // Rolagem automática do chat\n  useEffect(() => {\n    if (view === \'chat\' && chatEndRef.current) {\n      chatEndRef.current.scrollIntoView({\n        behavior: \'smooth\'\n      });\n    }\n  }, [chatHistory, view]);\n\n  // Polling de status do motor quando ativo na visualização do agente\n  useEffect(() => {\n    if (view === \'agent\' && agentSubView === \'engine\') {\n      fetchEngineStatus();\n      const iv = setInterval(fetchEngineStatus, 10000);\n      return () => clearInterval(iv);\n    }\n  }, [view, agentSubView]);'
);

// 5. Populate stateRef.current right before contextValue
console.log('5. Injecting stateRef assignment...');
html = html.replace(
  '  const contextValue = {\n    view, setView,',
  '  stateRef.current = {\n    view, setView,\n    partners, setPartners,\n    leads, setLeads,\n    actions, setActions,\n    stages, setStages,\n    obLeads, setObLeads,\n    obGeladeira, setObGeladeira,\n    cadences, setCadences,\n    agentConfig, setAgentConfig,\n    knowledge, setKnowledge,\n    chatHistory, setChatHistory,\n    activityLog, setActivityLog,\n    agentLog, setAgentLog,\n    dashboard, setDashboard,\n    indicacoes, setIndicacoes,\n    loading, setLoading,\n    pFilter, setPFilter,\n    search, setSearch,\n    modal, setModal,\n    obSubView, setObSubView,\n    agentSubView, setAgentSubView,\n    knowledgeSubView, setKnowledgeSubView,\n    editingCadence, setEditingCadence,\n    contentRef, sidebarRef, chatEndRef, chatInputRef,\n    loadData, setupGrabScroll, gsContent, gsSidebar,\n    openWA, saveLead, deleteLead, moveLead, savePartner, deletePartner,\n    saveTask, toggleTask, addToOutbound, moveObLead, togglePauseOb,\n    reactivateFromGeladeira, discardFromGeladeira, saveCadence, deleteCadence,\n    duplicateCadence, sendChat, importLeadFile, uploadKnowledgeFile,\n    addKnowledgeUrl, saveFaq, saveObjection, saveText, saveAgentConfig,\n    stats, filteredLeads,\n    G5X_STAGES, OB_STAGES, ORIGEM_INDICACAO, B, fmtDate, chatSending, setChatSending, fetchEngineStatus, engineStatus, engineLogs, setEngineStatus, setEngineLogs, handleObLeadDrop\n  };\n\n  const contextValue = {\n    view, setView,'
);

// 6. Memoize KanbanColumn
console.log('6. Memoizing KanbanColumn...');
const oldColumn = `const KanbanColumn=({stage,leadsList,onDrop})=>{
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
  };`;

const newColumn = `const KanbanColumn = useMemo(() => {
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
    };`;

html = html.replace(oldColumn, newColumn);

// Also need to close useMemo for KanbanColumn
html = html.replace(
  '  </div>\n  );\n};',
  '  </div>\n  );\n  };\n}, []);'
);

// 7. Update ObCard for Draggable support
console.log('7. Updating ObCard for drag-and-drop...');
const oldObCard = `const ObCard=({ol})=>{
 const {setModal}=React.useContext(AppContext);
 return (
 <div className="ob-card" onClick={()=>setModal({type:'obDetail',data:ol})}
 style={{background:'var(--graphite)',borderRadius:8,padding:10,marginBottom:5,borderLeftColor:OB_STAGES.find(s=>s.id===ol.status)?.color||'var(--border)'}}>`;

const newObCard = `const ObCard=({ol})=>{
 const {setModal, OB_STAGES, fmtDate}=stateRef.current;
 const handleDragStart = e => {
   e.dataTransfer.setData('text/plain', ol.id);
 };
 return (
 <div className="ob-card" 
 draggable
 onDragStart={handleDragStart}
 onClick={()=>setModal({type:'obDetail',data:ol})}
 style={{background:'var(--graphite)',borderRadius:8,padding:10,marginBottom:5,borderLeftColor:OB_STAGES.find(s=>s.id===ol.status)?.color||'var(--border)', cursor: 'grab'}}>`;

html = html.replace(oldObCard, newObCard);

// 8. Update ObPipeline to dynamic columns and drag-and-drop support
console.log('8. Updating ObPipeline...');
const oldObPipeline = `const ObPipeline=()=>{
 const {contentRef,gsContent,obLeads}=React.useContext(AppContext);
 return (
 <div className="grab-scroll" ref={contentRef} onMouseDown={gsContent.onMouseDown} onMouseMove={gsContent.onMouseMove}
 onMouseUp={gsContent.onMouseUp} onMouseLeave={gsContent.onMouseLeave}
 style={{display:'flex',gap:12,padding:'16px 24px',overflowX:'auto',overflowY:'hidden',flex:1}}>
 {OB_STAGES.map(s=>(
 <div key={s.id} className="kanban-column" style={{minWidth:240,flex:1,padding:12}}>
 <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
 <div style={{width:10,height:10,borderRadius:'50%',background:s.color}}/>
 <div style={{fontWeight:700,fontSize:13,color:'white'}}>{s.title}</div>
 <div style={{marginLeft:'auto',fontSize:12,color:'#8b949e'}}>{obLeads.filter(l=>l.status===s.id).length}</div>
 </div>
 <div style={{maxHeight:'calc(100vh - 220px)',overflowY:'auto'}}>
 {obLeads.filter(l=>l.status===s.id).map(l=><ObCard key={l.id} ol={l}/>)}
 </div>
 </div>
 ))}
 </div>
);};`;

const newObPipeline = `const ObPipelineColumn = ({ stage, leadsList, onDrop }) => {
  const { setModal } = stateRef.current;
  const [dragOver, setDragOver] = useState(false);
  const handleDragOver = e => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = e => {
    e.preventDefault();
    setDragOver(false);
    const leadId = e.dataTransfer.getData('text/plain');
    onDrop(leadId, stage.id);
  };

  return (
    <div 
      className={\`kanban-column \${dragOver ? 'drop-target' : ''}\`}
      onDragOver={handleDragOver} 
      onDragLeave={handleDragLeave} 
      onDrop={handleDrop}
      style={{minWidth:240, flex:1, padding:12, transition:'all .15s'}}
    >
      <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:12}}>
        <div style={{width:10, height:10, borderRadius:'50%', background:stage.color}}/>
        <div style={{fontWeight:700, fontSize:13, color:'white'}}>{stage.title}</div>
        <div style={{marginLeft:'auto', fontSize:12, color:'#8b949e'}}>{leadsList.length}</div>
      </div>
      <div style={{maxHeight:'calc(100vh - 220px)', overflowY:'auto'}}>
        {leadsList.map(l => <ObCard key={l.id} ol={l}/>)}
        {leadsList.length === 0 && <div style={{textAlign:'center', color:'var(--border)', fontSize:12, padding:16}}>Vazio</div>}
      </div>
    </div>
  );
};

const ObPipeline=()=>{
  const {contentRef, gsContent, obLeads, cadences, handleObLeadDrop}=stateRef.current;
  const activeCadence = cadences.find(c => c.status === 'Ativa');
  let obStages = [];

  if (activeCadence && activeCadence.cadence_steps && activeCadence.cadence_steps.length > 0) {
    obStages.push({ id: 'fila', title: 'Fila', color: '#8b949e', filter: l => l.status === 'fila' && !l.paused });
    const colors = ['#3b82f6', '#d29922', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4'];
    activeCadence.cadence_steps.forEach((step, idx) => {
      const stepNum = step.step_number;
      obStages.push({
        id: \`step_\${stepNum}\`,
        title: \`Passo \${stepNum} (\${step.channel})\`,
        color: colors[idx % colors.length],
        filter: l => l.status !== 'fila' && l.status !== 'objecao' && l.status !== 'resposto' && l.status !== 'convertido' && l.status !== 'descartado' && l.cadencia_step === stepNum && !l.paused
      });
    });
    obStages.push({ id: 'objecao', title: 'Objeção', color: '#ef4444', filter: l => l.status === 'objecao' && !l.paused });
    obStages.push({ id: 'resposto', title: 'Resposto / Convertido', color: '#10b981', filter: l => (l.status === 'resposto' || l.status === 'convertido') && !l.paused });
    obStages.push({ id: 'pausado', title: 'Pausados / Congelados', color: '#6e7681', filter: l => l.paused || l.status === 'descartado' });
  } else {
    obStages = [
      { id: 'fila', title: 'Fila', color: '#8b949e', filter: l => l.status === 'fila' },
      { id: 'ativo', title: 'Em Execução', color: '#3b82f6', filter: l => l.status !== 'fila' && l.status !== 'objecao' && l.status !== 'resposto' && l.status !== 'convertido' && l.status !== 'descartado' && !l.paused },
      { id: 'objecao', title: 'Objeção', color: '#ef4444', filter: l => l.status === 'objecao' },
      { id: 'resposto', title: 'Respostos', color: '#10b981', filter: l => l.status === 'resposto' || l.status === 'convertido' },
      { id: 'pausado', title: 'Pausados', color: '#6e7681', filter: l => l.paused || l.status === 'descartado' }
    ];
  }

  return (
    <div className="grab-scroll" ref={contentRef} onMouseDown={gsContent.onMouseDown} onMouseMove={gsContent.onMouseMove}
      onMouseUp={gsContent.onMouseUp} onMouseLeave={gsContent.onMouseLeave}
      style={{display:'flex', gap:12, padding:'16px 24px', overflowX:'auto', overflowY:'hidden', flex:1}}>
      {obStages.map(s => (
        <ObPipelineColumn 
          key={s.id} 
          stage={s} 
          leadsList={obLeads.filter(s.filter)} 
          onDrop={handleObLeadDrop}
        />
      ))}
    </div>
  );
};`;

html = html.replace(oldObPipeline, newObPipeline);

// Convert back to CRLF
html = html.replace(/\n/g, '\r\n');
fs.writeFileSync('public/index.dev.html', html);
console.log('Done!');
