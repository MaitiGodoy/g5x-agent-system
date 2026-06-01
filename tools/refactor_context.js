const fs = require('fs');

const filePath = 'public/index.dev.html';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Declare AppContext in global scope
content = content.replace(
  'const B=window.G5XBridge;',
  'const B=window.G5XBridge;\n\nconst AppContext = React.createContext(null);'
);

// 2. End the App component earlier
const appEndTarget = `const filteredLeads=leads.filter(l=>
 (pFilter==='All'||l.partner_id===pFilter)&&
 (l.name?.toLowerCase().includes(search.toLowerCase())||l.company?.toLowerCase().includes(search.toLowerCase()))
);`;

const appEndReplacement = `const filteredLeads=leads.filter(l=>
 (pFilter==='All'||l.partner_id===pFilter)&&
 (l.name?.toLowerCase().includes(search.toLowerCase())||l.company?.toLowerCase().includes(search.toLowerCase()))
);

  const contextValue = {
    view, setView,
    partners, setPartners,
    leads, setLeads,
    actions, setActions,
    stages, setStages,
    obLeads, setObLeads,
    obGeladeira, setObGeladeira,
    cadences, setCadences,
    agentConfig, setAgentConfig,
    knowledge, setKnowledge,
    chatHistory, setChatHistory,
    activityLog, setActivityLog,
    agentLog, setAgentLog,
    dashboard, setDashboard,
    indicacoes, setIndicacoes,
    loading, setLoading,
    pFilter, setPFilter,
    search, setSearch,
    modal, setModal,
    obSubView, setObSubView,
    agentSubView, setAgentSubView,
    knowledgeSubView, setKnowledgeSubView,
    editingCadence, setEditingCadence,
    contentRef, sidebarRef, chatEndRef, chatInputRef,
    loadData, setupGrabScroll, gsContent, gsSidebar,
    openWA, saveLead, deleteLead, moveLead, savePartner, deletePartner,
    saveTask, toggleTask, addToOutbound, moveObLead, togglePauseOb,
    reactivateFromGeladeira, discardFromGeladeira, saveCadence, deleteCadence,
    duplicateCadence, sendChat, importLeadFile, uploadKnowledgeFile,
    addKnowledgeUrl, saveFaq, saveObjection, saveText, saveAgentConfig,
    stats, filteredLeads
  };

  return (
    <AppContext.Provider value={contextValue}>
      <Root/>
    </AppContext.Provider>
  );
};`;

if (content.includes(appEndTarget)) {
  content = content.replace(appEndTarget, appEndReplacement);
  console.log('App end injected successfully.');
} else {
  console.error('Error: Could not find appEndTarget');
  process.exit(1);
}

// 3. Update Sidebar component
content = content.replace(
  `const Sidebar=()=>(
 <div ref={sidebarRef} className="sidebar"`,
  `const Sidebar=()=>{\n const {sidebarRef,view,setView,leads,indicacoes,stats} = React.useContext(AppContext);\n return (\n <div ref={sidebarRef} className="sidebar"`
);

content = content.replace(
  `  </div>
  </div>
 </div>
);

const TopBar=()=>(`,
  `  </div>\n  </div>\n </div>\n );\n};\n\nconst TopBar=()=>(`
);

// 4. Update TopBar component
content = content.replace(
  `const TopBar=()=>(
 <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 24px',borderBottom:'1px solid var(--border-subtle)',background:'var(--black)'}}>`,
  `const TopBar=()=>{\n const {view,setView,search,setSearch,pFilter,setPFilter,partners,setModal,importLeadFile,loadData} = React.useContext(AppContext);\n return (\n <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 24px',borderBottom:'1px solid var(--border-subtle)',background:'var(--black)'}}>`
);

content = content.replace(
  `  </button>
  </div>
  </div>
);

const LoadingScreen=()=>(`,
  `  </button>\n  </div>\n  </div>\n );\n};\n\nconst LoadingScreen=()=>(`
);

// 5. Update LeadCard component
content = content.replace(
  `const LeadCard=({lead})=>{
 const days=getDaysInStage(lead.last_stage_change);`,
  `const LeadCard=({lead})=>{\n const {partners,stages,setModal}=React.useContext(AppContext);\n const days=getDaysInStage(lead.last_stage_change);`
);

// 6. Update KanbanColumn component
content = content.replace(
  `const KanbanColumn=({stage,leadsList,onDrop})=>{
  const[dragOver,setDragOver]=useState(false);`,
  `const KanbanColumn=({stage,leadsList,onDrop})=>{\n  const {leads,setModal}=React.useContext(AppContext);\n  const[dragOver,setDragOver]=useState(false);`
);

// 7. Update KanbanView component
content = content.replace(
  `const KanbanView=()=>{
  const sourceTabs=[`,
  `const KanbanView=()=>{\n  const {filteredLeads,setModal,contentRef,gsContent,stages}=React.useContext(AppContext);\n  const[sourceFilter,setSourceFilter]=useState('todas');\n  const sourceTabs=[`
);

// 8. Update ObCard component
content = content.replace(
  `const ObCard=({ol})=>(
 <div className="ob-card" onClick={()=>setModal({type:'obDetail',data:ol})}`,
  `const ObCard=({ol})=>{\n const {setModal}=React.useContext(AppContext);\n return (\n <div className="ob-card" onClick={()=>setModal({type:'obDetail',data:ol})}`
);

content = content.replace(
  ` <span>{fmtDate(ol.last_contact)}</span></>}
 </div>
 </div>
);

const ObPipeline=()=>(`,
  ` <span>{fmtDate(ol.last_contact)}</span></>}\n </div>\n </div>\n );\n};\n\nconst ObPipeline=()=>(`
);

// 9. Update ObPipeline component
content = content.replace(
  `const ObPipeline=()=>(
 <div className="grab-scroll" ref={contentRef} onMouseDown={gsContent.onMouseDown} onMouseMove={gsContent.onMouseMove}`,
  `const ObPipeline=()=>{\n const {contentRef,gsContent,obLeads}=React.useContext(AppContext);\n return (\n <div className="grab-scroll" ref={contentRef} onMouseDown={gsContent.onMouseDown} onMouseMove={gsContent.onMouseMove}`
);

content = content.replace(
  `  {obLeads.filter(l=>l.status===s.id).map(l=><ObCard key={l.id} ol={l}/>)}
  </div>
  </div>
  )}
  </div>
);

// PARTE 7b — GELADEIRA`,
  `  {obLeads.filter(l=>l.status===s.id).map(l=><ObCard key={l.id} ol={l}/>)}\n  </div>\n  </div>\n  )}\n  </div>\n );\n};\n\n// PARTE 7b — GELADEIRA`
);

// 10. Update GeladeiraView component
content = content.replace(
  `const GeladeiraView=()=>(
 <div style={{padding:'16px 24px',overflowY:'auto',flex:1}}>`,
  `const GeladeiraView=()=>{\n const {obGeladeira,reactivateFromGeladeira,discardFromGeladeira}=React.useContext(AppContext);\n return (\n <div style={{padding:'16px 24px',overflowY:'auto',flex:1}}>\n`
);

content = content.replace(
  `  </div>
  ))}
  </div>}
  </div>
);
// PARTE 7c — CADÊNCIAS`,
  `  </div>\n  ))}\n  </div>}\n  </div>\n );\n};\n// PARTE 7c — CADÊNCIAS`
);

// 11. Update CadencesView component
content = content.replace(
  `const CadencesView=()=>(
 <div style={{padding:'16px 24px',overflowY:'auto',flex:1}}>`,
  `const CadencesView=()=>{\n const {editingCadence,setEditingCadence,saveCadence,duplicateCadence,deleteCadence,cadences}=React.useContext(AppContext);\n return (\n <div style={{padding:'16px 24px',overflowY:'auto',flex:1}}>`
);

content = content.replace(
  `  </div>
  ))}
  </div>}
  </>}
  </div>
);

// PARTE 7d — OUTBOUND VIEW (Operacional — sem pipeline)`,
  `  </div>\n  ))}\n  </div>}\n  </>}\n  </div>\n );\n};\n\n// PARTE 7d — OUTBOUND VIEW (Operacional — sem pipeline)`
);

// 12. Update OutboundView component
content = content.replace(
  `const OutboundView=()=>{
 const tabs=[`,
  `const OutboundView=()=>{\n const {obSubView,setObSubView,cadences,obLeads,obGeladeira,agentConfig}=React.useContext(AppContext);\n const tabs=[`
);

// 13. Update AgentConfigView component
content = content.replace(
  `const AgentConfigView=()=>(
 <div style={{padding:'16px 24px',overflowY:'auto',flex:1,maxWidth:600}}>`,
  `const AgentConfigView=()=>{\n const {agentConfig,setAgentConfig,saveAgentConfig}=React.useContext(AppContext);\n return (\n <div style={{padding:'16px 24px',overflowY:'auto',flex:1,maxWidth:600}}>`
);

content = content.replace(
  ` <button onClick={()=>saveAgentConfig(agentConfig)} style={{background:'var(--gold)',color:'black',border:'none',padding:'10px 20px',borderRadius:8,fontWeight:700,fontSize:14,cursor:'pointer',marginTop:8}}>Salvar Configuração</button>
  </div>
  </div>
);

// PARTE 8b — AGENT LOG VIEW`,
  ` <button onClick={()=>saveAgentConfig(agentConfig)} style={{background:'var(--gold)',color:'black',border:'none',padding:'10px 20px',borderRadius:8,fontWeight:700,fontSize:14,cursor:'pointer',marginTop:8}}>Salvar Configuração</button>\n  </div>\n  </div>\n );\n};\n\n// PARTE 8b — AGENT LOG VIEW`
);

// 14. Update AgentLogView component
content = content.replace(
  `const AgentLogView=()=>(
 <div style={{padding:'16px 24px',overflowY:'auto',flex:1}}>`,
  `const AgentLogView=()=>{\n const {agentLog}=React.useContext(AppContext);\n return (\n <div style={{padding:'16px 24px',overflowY:'auto',flex:1}}>`
);

content = content.replace(
  `  </div>
  ))}
  </div>}
  </div>
);

// PARTE 8c — ACTIVITY LOG E AGENT VIEW`,
  `  </div>\n  ))}\n  </div>}\n  </div>\n );\n};\n\n// PARTE 8c — ACTIVITY LOG E AGENT VIEW`
);

// 15. Update ActivityLogView component
content = content.replace(
  `const ActivityLogView=()=>(
 <div style={{padding:'16px 24px',overflowY:'auto',flex:1}}>`,
  `const ActivityLogView=()=>{\n const {activityLog}=React.useContext(AppContext);\n return (\n <div style={{padding:'16px 24px',overflowY:'auto',flex:1}}>`
);

content = content.replace(
  `  </div>
  ))}
  </div>}
  </div>
);

// ── Engine Dashboard ──`,
  `  </div>\n  ))}\n  </div>}\n  </div>\n );\n};\n\n// ── Engine Dashboard ──`
);

// 16. Update EngineDashboard component (localize states)
content = content.replace(
  `// ── Engine Dashboard ──
const[engineStatus,setEngineStatus]=useState(null);
const[engineLogs,setEngineLogs]=useState([]);

const fetchEngineStatus=async()=>{
  const s=await B.getEngineStatus(); if(s)setEngineStatus(s);
  const l=await B.getEngineLog(); if(l)setEngineLogs(l);
};

const EngineDashboard=()=>{
  useEffect(()=>{fetchEngineStatus();const iv=setInterval(fetchEngineStatus,10000);return()=>clearInterval(iv)},[]);`,
  `// ── Engine Dashboard ──\n\nconst EngineDashboard=()=>{\n  const[engineStatus,setEngineStatus]=useState(null);\n  const[engineLogs,setEngineLogs]=useState([]);\n\n  const fetchEngineStatus=async()=>{\n    const s=await B.getEngineStatus(); if(s)setEngineStatus(s);\n    const l=await B.getEngineLog(); if(l)setEngineLogs(l);\n  };\n  useEffect(()=>{fetchEngineStatus();const iv=setInterval(fetchEngineStatus,10000);return()=>clearInterval(iv)},[]);`
);

// 17. Update AgentView component
content = content.replace(
  `const AgentView=()=>{
  const tabs=[`,
  `const AgentView=()=>{\n  const {agentSubView,setAgentSubView}=React.useContext(AppContext);\n  const tabs=[`
);

// 18. Update ChatView component
content = content.replace(
  `const ChatView=()=>{
 useEffect(()=>{`,
  `const ChatView=()=>{\n const {chatEndRef,chatHistory,chatInputRef,sendChat}=React.useContext(AppContext);\n useEffect(()=>{`
);

// 19. Update PartnersView component
content = content.replace(
  `const PartnersView=()=>(
 <div style={{padding:'16px 24px',overflowY:'auto',flex:1}}>`,
  `const PartnersView=()=>{\n const {partners,leads,setModal}=React.useContext(AppContext);\n return (\n <div style={{padding:'16px 24px',overflowY:'auto',flex:1}}>`
);

content = content.replace(
  `  </div>
  );
  })}
  </div>}
  </div>
);

// PARTE 10b — BI VIEW`,
  `  </div>\n  );\n  })}\n  </div>}\n  </div>\n );\n};\n\n// PARTE 10b — BI VIEW`
);

// 20. Update BiView component
content = content.replace(
  `const BiView=()=>{
 const won=leads.filter(l=>l.status==='credito_na_tela');`,
  `const BiView=()=>{\n const {leads,stats,obLeads,obGeladeira,partners,stages}=React.useContext(AppContext);\n const won=leads.filter(l=>l.status==='credito_na_tela');`
);

// 21. Update IndicacoesView component
content = content.replace(
  `const IndicacoesView=()=>{
  const[tab,setTab]=useState('lista');`,
  `const IndicacoesView=()=>{\n  const {indicacoes,loadData}=React.useContext(AppContext);\n  const[tab,setTab]=useState('lista');`
);

// 22. Update ApproachTemplateModal component
content = content.replace(
  `const ApproachTemplateModal=({lead})=>{
  const ehIndicacao=isIndicacao(lead);`,
  `const ApproachTemplateModal=({lead})=>{\n  const {setModal}=React.useContext(AppContext);\n  const ehIndicacao=isIndicacao(lead);`
);

// 23. Update StageMoveModal component
content = content.replace(
  `const StageMoveModal=({data:{lead,newStage,stageInfo,camposNeeded,msg}})=>{
  const[obs,setObs]=useState('');`,
  `const StageMoveModal=({data:{lead,newStage,stageInfo,camposNeeded,msg}})=>{\n  const {loadData,setModal}=React.useContext(AppContext);\n  const[obs,setObs]=useState('');`
);

// 24. Update OutputProtocolModal component
content = content.replace(
  `const OutputProtocolModal=()=>{
  const protoInfo={`,
  `const OutputProtocolModal=()=>{\n  const {setModal}=React.useContext(AppContext);\n  const protoInfo={`
);

// 25. Update NewLeadModal component
content = content.replace(
  `const NewLeadModal=()=>{
 const[f,setF]=useState({name:'',company:'',phone:'',email:'',linkedin_url:'',value:'',main_pain:'',job_title:'',partner_id:'',source:'manual',indicador_origem:''});`,
  `const NewLeadModal=()=>{\n const {partners,saveLead,setModal}=React.useContext(AppContext);\n const[f,setF]=useState({name:'',company:'',phone:'',email:'',linkedin_url:'',value:'',main_pain:'',job_title:'',partner_id:'',source:'manual',indicador_origem:''});`
);

// 26. Update LeadDetailModal component
content = content.replace(
  `const LeadDetailModal=({lead})=>{
 const[tab,setTab]=useState('info');`,
  `const LeadDetailModal=({lead})=>{\n const {actions,partners,stages,setModal,saveTask,toggleTask,addToOutbound}=React.useContext(AppContext);\n const[tab,setTab]=useState('info');`
);

// 27. Update PartnerModal component
content = content.replace(
  `const PartnerModal=({partner})=>{
 const[f,setF]=useState(partner||{name:'',phone:'',comm_value:'',obs:'',indicator:''});`,
  `const PartnerModal=({partner})=>{\n const {savePartner,deletePartner,setModal}=React.useContext(AppContext);\n const[f,setF]=useState(partner||{name:'',phone:'',comm_value:'',obs:'',indicator:''});`
);

// 28. Update ObDetailModal component
content = content.replace(
  `const ObDetailModal=({ol})=>{
 const[history,setHistory]=useState([]);`,
  `const ObDetailModal=({ol})=>{\n const {setModal,togglePauseOb}=React.useContext(AppContext);\n const[history,setHistory]=useState([]);`
);

// 29. Update KnowledgeView component
content = content.replace(
  `const KnowledgeView=()=>{
 const tabs=[{id:'docs',label:'📄 Docs'},{id:'urls',label:'🔗 URLs'},{id:'faq',label:'❓ FAQ'},{id:'objections',label:'🛡️ Obj'},{id:'texts',label:'📝 Textos'}];
 const[urlInput,setUrlInput]=useState('');`,
  `const KnowledgeView=()=>{\n const {knowledgeSubView,setKnowledgeSubView,knowledge,uploadKnowledgeFile,addKnowledgeUrl,saveFaq,saveObjection,saveText,loadData}=React.useContext(AppContext);\n const tabs=[{id:'docs',label:'📄 Docs'},{id:'urls',label:'🔗 URLs'},{id:'faq',label:'❓ FAQ'},{id:'objections',label:'🛡️ Obj'},{id:'texts',label:'📝 Textos'}];\n const[urlInput,setUrlInput]=useState('');`
);

// 30. Update Content component
content = content.replace(
  `const Content=()=>{
 if(loading)return<LoadingScreen/>;`,
  `const Content=()=>{\n const {loading,view}=React.useContext(AppContext);\n if(loading)return<LoadingScreen/>;`
);

// 31. Update Modals component
content = content.replace(
  `const Modals=()=>(
 <>
 {modal.type==='newLead'&&<NewLeadModal/>}
 {modal.type==='leadDetail'&&modal.data&&<LeadDetailModal lead={modal.data}/>}
 {modal.type==='partner'&&<PartnerModal partner={modal.data}/>}
 {modal.type==='obDetail'&&modal.data&&<ObDetailModal ol={modal.data}/>}
 {modal.type==='approachTemplate'&&modal.data&&<ApproachTemplateModal lead={modal.data}/>}
 {modal.type==='stageMove'&&modal.data&&<StageMoveModal data={modal.data}/>}
 {modal.type==='outputProtocol'&&<OutputProtocolModal/>}
 </>
);`,
  `const Modals=()=>{\n const {modal,setModal}=React.useContext(AppContext);\n return (\n <>\n {modal.type==='newLead'&&<NewLeadModal/>}\n {modal.type==='leadDetail'&&modal.data&&<LeadDetailModal lead={modal.data}/>}\n {modal.type==='partner'&&<PartnerModal partner={modal.data}/>}\n {modal.type==='obDetail'&&modal.data&&<ObDetailModal ol={modal.data}/>}\n {modal.type==='approachTemplate'&&modal.data&&<ApproachTemplateModal lead={modal.data}/>}\n {modal.type==='stageMove'&&modal.data&&<StageMoveModal data={modal.data}/>}\n {modal.type==='outputProtocol'&&<OutputProtocolModal/>}\n </>\n );\n};`
);

// 32. Remove return <Root /> from the very end of App
const endTarget = ` return <Root/>;
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);`;

const endReplacement = `ReactDOM.createRoot(document.getElementById('root')).render(<App/>);`;

if (content.includes(endTarget)) {
  content = content.replace(endTarget, endReplacement);
  console.log('End target replaced successfully.');
} else {
  console.error('Error: Could not find endTarget');
  process.exit(1);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Refactoring finished successfully!');
