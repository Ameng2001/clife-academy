import { Component } from 'react'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('页面渲染出错', error, info?.componentStack) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="narrow" style={{ textAlign: 'center' }}>
        <div className="empty" style={{ marginTop: '18vh' }}>
          <div className="ico"><Icon name="info" /></div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>出了点问题</div>
          这一页画不出来。进度还在这台设备上。
        </div>
        <Button variant="primary" icon="reset" onClick={() => location.reload()}>重新加载</Button>
      </div>
    )
  }
}
