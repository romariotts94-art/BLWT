'use client';
import React from 'react';
export default class ModuleBoundary extends React.Component<{name:string,children:React.ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true}}
 componentDidCatch(error:Error){console.error('Module unavailable:',this.props.name,error.message)}
 render(){return this.state.failed?<section className="op-panel" role="status"><h3>{this.props.name} временно недоступен</h3><p>Остальные разделы продолжают работать.</p><button className="btn secondary" onClick={()=>this.setState({failed:false})}>Попробовать снова</button></section>:this.props.children}
}
