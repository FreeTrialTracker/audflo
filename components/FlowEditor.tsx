'use client';

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  Suspense,
} from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  Handle,
  Position,
  useReactFlow,
  BackgroundVariant,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

// ─── Types ──────────────────────────────────────────────────────────────────
interface NodeData {
  type: 'trigger' | 'branch' | 'action';
  title: string;
  subtitle: string;
  accent: string;
  running?: boolean;
  done?: boolean;
  doneLabel?: string;
  warning?: boolean;
}

interface ContextMenu {
  nodeId: string;
  x: number;
  y: number;
}

interface ConfigField {
  label: string;
  type: 'text' | 'textarea' | 'dropdown';
  value: string;
  options?: string[];
  readonly?: boolean;
}

interface NodeConfig {
  [key: string]: ConfigField[];
}

// ─── Constants ───────────────────────────────────────────────────────────────
const ACCENT: Record<string, string> = {
  trigger: '#2845D4',
  branch: '#7A4FE8',
  action_rose: '#E8497A',
  action_orange: '#F26B3A',
};

const TYPE_COLORS: Record<string, string> = {
  'slack.message.new': '#2845D4',
  'slack.reaction.added': '#2845D4',
  'schedule.daily': '#2845D4',
  'form.submitted': '#2845D4',
  'webhook.received': '#2845D4',
  'slack.send.message': '#E8497A',
  'slack.send.dm': '#F26B3A',
  'linear.create.ticket': '#E8497A',
  'notion.append.row': '#F26B3A',
  'sheets.add.row': '#E8497A',
  'branch.if': '#7A4FE8',
  'delay.wait': '#7A4FE8',
  'variable.set': '#7A4FE8',
};

const TYPE_CATEGORY: Record<string, 'trigger' | 'branch' | 'action'> = {
  'slack.message.new': 'trigger',
  'slack.reaction.added': 'trigger',
  'schedule.daily': 'trigger',
  'form.submitted': 'trigger',
  'webhook.received': 'trigger',
  'slack.send.message': 'action',
  'slack.send.dm': 'action',
  'linear.create.ticket': 'action',
  'notion.append.row': 'action',
  'sheets.add.row': 'action',
  'branch.if': 'branch',
  'delay.wait': 'branch',
  'variable.set': 'branch',
};

const DEFAULT_CONFIG: NodeConfig = {
  'n1': [
    { label: 'Channel', type: 'text', value: '#support' },
    { label: 'Filter', type: 'text', value: 'contains "urgent"' },
    { label: 'User scope', type: 'dropdown', value: 'All members', options: ['All members', 'Bot messages only', 'Human only'] },
  ],
  'n2': [
    { label: 'Condition', type: 'text', value: "message.text contains 'urgent'" },
    { label: 'If true', type: 'text', value: '→ DM @oncall engineer', readonly: true },
    { label: 'If false', type: 'text', value: '→ Create Linear ticket', readonly: true },
  ],
  'n3': [
    { label: 'Team', type: 'dropdown', value: 'Engineering', options: ['Engineering', 'Design', 'Product'] },
    { label: 'Priority', type: 'dropdown', value: 'P2 — Medium', options: ['P1 — Urgent', 'P2 — Medium', 'P3 — Low'] },
    { label: 'Title template', type: 'text', value: 'Support: {{message.text | truncate 60}}' },
  ],
  'n4': [
    { label: 'Recipient', type: 'text', value: '@oncall' },
    { label: 'Message', type: 'textarea', value: '🚨 Urgent in #support: {{message.text}}' },
  ],
};

const DEFAULT_NODES: Node<NodeData>[] = [
  {
    id: 'n1', type: 'audflo', position: { x: 280, y: 30 },
    data: { type: 'trigger', title: 'New #support message', subtitle: 'slack.message.new', accent: '#2845D4' },
  },
  {
    id: 'n2', type: 'audflo', position: { x: 280, y: 175 },
    data: { type: 'branch', title: "Contains 'urgent'?", subtitle: 'branch.if', accent: '#7A4FE8' },
  },
  {
    id: 'n3', type: 'audflo', position: { x: 60, y: 320 },
    data: { type: 'action', title: 'Create Linear ticket', subtitle: 'linear.create.ticket', accent: '#E8497A' },
  },
  {
    id: 'n4', type: 'audflo', position: { x: 500, y: 320 },
    data: { type: 'action', title: 'DM @oncall engineer', subtitle: 'slack.send.dm', accent: '#F26B3A' },
  },
];

const makeEdge = (id: string, source: string, target: string, label?: string, color = '#7A4FE8'): Edge => ({
  id, source, target,
  type: 'smoothstep',
  label,
  labelStyle: { fill: '#A8A095', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' },
  labelBgStyle: { fill: '#1A1820', fillOpacity: 0.9 },
  style: { stroke: color, strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color },
});

const DEFAULT_EDGES: Edge[] = [
  makeEdge('e1-2', 'n1', 'n2', undefined, '#2845D4'),
  makeEdge('e2-3', 'n2', 'n3', 'FALSE', '#E8497A'),
  makeEdge('e2-4', 'n2', 'n4', 'TRUE', '#F26B3A'),
];

const MOCK_RUNS = [
  { id: 1, time: '2m ago', status: true, label: 'DM sent to @oncall' },
  { id: 2, time: '18m ago', status: true, label: 'Linear ticket #241 created' },
  { id: 3, time: '1h ago', status: false, label: 'Connection timeout' },
  { id: 4, time: '3h ago', status: true, label: 'DM sent to @oncall' },
  { id: 5, time: '5h ago', status: true, label: 'Linear ticket #238 created' },
];

const PANEL_STEPS = [
  { section: 'TRIGGERS', items: ['slack.message.new', 'slack.reaction.added', 'schedule.daily', 'form.submitted', 'webhook.received'] },
  { section: 'ACTIONS', items: ['slack.send.message', 'slack.send.dm', 'linear.create.ticket', 'notion.append.row', 'sheets.add.row'] },
  { section: 'LOGIC', items: ['branch.if', 'delay.wait', 'variable.set'] },
];

// ─── Custom Node ──────────────────────────────────────────────────────────
function AudfloNode({ id, data, selected }: { id: string; data: NodeData; selected?: boolean }) {
  const typeLabel = data.type.toUpperCase();
  return (
    <div
      aria-label={`${typeLabel} node: ${data.title}`}
      style={{
        background: '#1A1820',
        border: `2px solid ${selected ? data.accent : data.running ? data.accent : '#2A2730'}`,
        borderRadius: 12,
        padding: '10px 14px',
        minWidth: 200,
        boxShadow: selected
          ? `0 0 0 3px ${data.accent}40, 0 4px 20px rgba(0,0,0,0.5)`
          : data.running
          ? `0 0 14px ${data.accent}80`
          : '0 2px 12px rgba(0,0,0,0.4)',
        position: 'relative',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        cursor: 'grab',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: data.accent, border: 'none', width: 8, height: 8 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: data.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {typeLabel}
        </span>
        {data.warning && (
          <span style={{ fontSize: 10, color: '#F26B3A', fontFamily: 'JetBrains Mono, monospace' }} title="Unconnected node">⚠</span>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#F5F1E8', fontFamily: 'Inter, sans-serif', marginBottom: 2 }}>
        {data.title}
      </div>
      <div style={{ fontSize: 10, color: '#6B6357', fontFamily: 'JetBrains Mono, monospace' }}>
        {data.subtitle}
      </div>
      {data.done && (
        <div style={{
          position: 'absolute', top: -10, right: -10,
          background: '#1A1820', border: `1.5px solid ${data.accent}`,
          borderRadius: 99, padding: '2px 7px',
          fontSize: 9, color: data.accent, fontFamily: 'JetBrains Mono, monospace',
          whiteSpace: 'nowrap', boxShadow: `0 0 8px ${data.accent}60`,
          animation: 'fadeInDown 0.3s ease',
        }}>
          ✓ {data.doneLabel}
        </div>
      )}
      {data.running && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 12,
          animation: 'pulseRing 0.8s ease-in-out infinite',
          border: `2px solid ${data.accent}`,
          pointerEvents: 'none',
        }} />
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: data.accent, border: 'none', width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes: NodeTypes = { audflo: AudfloNode };

// ─── Config Field ─────────────────────────────────────────────────────────
function ConfigFieldEl({ field, onChange }: { field: ConfigField; onChange: (v: string) => void }) {
  const base: React.CSSProperties = {
    background: '#0F0E13', border: '1px solid #2A2730', borderRadius: 6,
    color: '#F5F1E8', fontFamily: 'Inter, sans-serif', fontSize: 13,
    padding: '7px 10px', width: '100%', outline: 'none', boxSizing: 'border-box',
    resize: 'vertical' as const,
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6B6357', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {field.label}
      </div>
      {field.type === 'dropdown' ? (
        <select value={field.value} onChange={e => onChange(e.target.value)} style={{ ...base, cursor: 'pointer' }}>
          {(field.options ?? [field.value]).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea value={field.value} onChange={e => onChange(e.target.value)} rows={3} style={{ ...base }} readOnly={field.readonly} />
      ) : (
        <input value={field.value} onChange={e => onChange(e.target.value)} style={{ ...base }} readOnly={field.readonly} />
      )}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────
function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)',
      background: '#1A1820', border: '1px solid #2A2730', borderRadius: 99,
      padding: '10px 20px', color: '#F5F1E8', fontFamily: 'JetBrains Mono, monospace',
      fontSize: 12, whiteSpace: 'nowrap', boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
      zIndex: 100, animation: 'slideUp 0.3s ease',
    }}>
      {msg}
    </div>
  );
}

// ─── Run History Popover ─────────────────────────────────────────────────
function RunHistory({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: 'absolute', bottom: 60, left: 16,
      background: '#1A1820', border: '1px solid #2A2730', borderRadius: 12,
      padding: 16, width: 280, zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#A8A095', textTransform: 'uppercase' }}>RUN HISTORY</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B6357', cursor: 'pointer', fontSize: 14 }}>✕</button>
      </div>
      {MOCK_RUNS.map(run => (
        <div key={run.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #2A2730' }}>
          <span style={{ color: run.status ? '#34A853' : '#E8497A', fontSize: 13 }}>{run.status ? '✓' : '✗'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#F5F1E8', fontFamily: 'Inter, sans-serif' }}>{run.label}</div>
            <div style={{ fontSize: 10, color: '#6B6357', fontFamily: 'JetBrains Mono, monospace' }}>{run.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Node Context Menu ────────────────────────────────────────────────────
function NodeContextMenu({
  menu,
  node,
  onDelete,
  onDuplicate,
  onDisconnect,
  onClose,
}: {
  menu: ContextMenu;
  node: Node<NodeData>;
  onDelete: () => void;
  onDuplicate: () => void;
  onDisconnect: () => void;
  onClose: () => void;
}) {
  const isTrigger = node.data.type === 'trigger';

  const menuItems = [
    { label: 'Duplicate node', icon: '⧉', action: onDuplicate, color: '#F5F1E8' },
    { label: 'Disconnect edges', icon: '⌀', action: onDisconnect, color: '#F5F1E8' },
    { label: 'Delete node', icon: '⌫', action: onDelete, color: '#E8497A', disabled: isTrigger },
  ];

  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [onClose]);

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: menu.x,
        top: menu.y,
        zIndex: 9999,
        background: '#1A1820',
        border: '1px solid #2A2730',
        borderRadius: 10,
        padding: '4px',
        minWidth: 190,
        boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)',
        animation: 'fadeInDown 0.15s ease',
      }}
    >
      {/* Node badge */}
      <div style={{
        padding: '8px 12px 6px',
        borderBottom: '1px solid #2A2730',
        marginBottom: 4,
      }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: node.data.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
          {node.data.type}
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#F5F1E8', fontWeight: 500 }}>
          {node.data.title}
        </div>
      </div>

      {menuItems.map(item => (
        <button
          key={item.label}
          disabled={item.disabled}
          onClick={() => { if (!item.disabled) { item.action(); onClose(); } }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', background: 'none', border: 'none',
            padding: '8px 12px', borderRadius: 7,
            color: item.disabled ? '#3A3730' : item.color,
            fontFamily: 'Inter, sans-serif', fontSize: 13,
            cursor: item.disabled ? 'not-allowed' : 'pointer',
            textAlign: 'left', transition: 'background 0.1s',
          }}
          onMouseEnter={e => { if (!item.disabled) (e.currentTarget as HTMLButtonElement).style.background = '#2A2730'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
        >
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
          {item.label}
          {item.disabled && (
            <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#3A3730' }}>protected</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Inner editor (needs ReactFlowProvider context) ──────────────────────
let nodeIdCounter = 10;

function FlowEditorInner() {
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(DEFAULT_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(DEFAULT_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('n1');
  const [config, setConfig] = useState<NodeConfig>(DEFAULT_CONFIG);
  const [runState, setRunState] = useState<'idle' | 'running' | 'done'>('idle');
  const [toast, setToast] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const lastSelectedRef = useRef<string | null>('n1');

  useEffect(() => { lastSelectedRef.current = selectedNodeId; }, [selectedNodeId]);

  const onConnect = useCallback((connection: Connection) => {
    const sourceNode = nodes.find(n => n.id === connection.source);
    const color = sourceNode?.data.accent ?? '#7A4FE8';
    setEdges(eds => addEdge({ ...connection, type: 'smoothstep', style: { stroke: color, strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color } }, eds));
  }, [nodes, setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setContextMenu(null);
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setSelectedNodeId(node.id);
    setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
  }, []);

  const deleteSelectedNode = useCallback((nodeId: string) => {
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    setConfig(prev => { const next = { ...prev }; delete next[nodeId]; return next; });
    setSelectedNodeId(null);
    setContextMenu(null);
  }, [setNodes, setEdges]);

  const duplicateNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const newId = `n${++nodeIdCounter}`;
    const newNode: Node<NodeData> = {
      ...node,
      id: newId,
      position: { x: node.position.x + 40, y: node.position.y + 60 },
      selected: false,
    };
    setNodes(nds => [...nds, newNode]);
    if (config[nodeId]) {
      setConfig(prev => ({ ...prev, [newId]: prev[nodeId].map(f => ({ ...f })) }));
    }
    setSelectedNodeId(newId);
    setContextMenu(null);
    setToast('Node duplicated');
  }, [nodes, setNodes, config]);

  const disconnectNode = useCallback((nodeId: string) => {
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    setContextMenu(null);
    setToast('Edges removed');
  }, [setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const stepType = event.dataTransfer.getData('application/audflo-step');
    if (!stepType) return;

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const category = TYPE_CATEGORY[stepType] ?? 'action';
    const accent = TYPE_COLORS[stepType] ?? '#E8497A';
    const newId = `n${++nodeIdCounter}`;
    const newNode: Node<NodeData> = {
      id: newId,
      type: 'audflo',
      position,
      data: {
        type: category,
        title: stepType.replace('.', ' ').replace(/-/g, ' '),
        subtitle: stepType,
        accent,
        warning: true,
      },
    };
    setNodes(nds => [...nds, newNode]);

    // Auto-connect to last selected node
    const prevId = lastSelectedRef.current;
    if (prevId) {
      const sourceNode = nodes.find(n => n.id === prevId);
      const edgeColor = sourceNode?.data.accent ?? accent;
      setEdges(eds => addEdge({
        id: `e${prevId}-${newId}`, source: prevId, target: newId,
        type: 'smoothstep',
        style: { stroke: edgeColor, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
      }, eds));
      // Remove warning once connected
      setNodes(nds => nds.map(n => n.id === newId ? { ...n, data: { ...n.data, warning: false } } : n));
    }
    setSelectedNodeId(newId);
  }, [screenToFlowPosition, setNodes, setEdges, nodes]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setContextMenu(null); return; }
    if ((e.key === 'Backspace' || e.key === 'Delete') && selectedNodeId && selectedNodeId !== 'n1') {
      deleteSelectedNode(selectedNodeId);
    }
  }, [selectedNodeId, deleteSelectedNode]);

  // Mark nodes as selected via data for custom node rendering
  const displayNodes = useMemo(() =>
    nodes.map(n => ({ ...n, selected: n.id === selectedNodeId })),
    [nodes, selectedNodeId]
  );

  // Config for selected node
  const selectedConfig = selectedNodeId && config[selectedNodeId] ? config[selectedNodeId] : null;
  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const updateConfigField = (nodeId: string, fieldIdx: number, value: string) => {
    setConfig(prev => ({
      ...prev,
      [nodeId]: prev[nodeId].map((f, i) => i === fieldIdx ? { ...f, value } : f),
    }));
  };

  const handleRun = async () => {
    if (runState !== 'idle') return;
    setRunState('running');

    const pulse = (id: string, label: string, done = false) =>
      setNodes(nds => nds.map(n =>
        n.id === id
          ? { ...n, data: { ...n.data, running: !done, done, doneLabel: done ? label : undefined } }
          : n
      ));

    pulse('n1', '', false);
    await delay(600);
    pulse('n1', 'Triggered', true);
    pulse('n2', '', false);
    await delay(600);
    pulse('n2', 'Evaluated: TRUE', true);
    pulse('n4', '', false);
    await delay(700);
    pulse('n4', 'DM sent to @oncall', true);
    setRunState('done');
    setToast('✓ Flow ran in 0.4s. View run history →');

    await delay(4000);
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, running: false, done: false, doneLabel: undefined } })));
    setRunState('idle');
  };

  const handleReset = () => {
    setNodes(DEFAULT_NODES);
    setEdges(DEFAULT_EDGES);
    setSelectedNodeId('n1');
    setConfig(DEFAULT_CONFIG);
    setRunState('idle');
    setShowHistory(false);
    setContextMenu(null);
  };

  const handleShare = () => {
    navigator.clipboard.writeText('https://audflo.com/flow/demo-support-triage').catch(() => {});
    setToast('✓ Copied share link');
  };

  const handleSave = () => {
    setToast('Sign up to save flows → #waitlist');
  };

  const hasNodes = nodes.length > 0;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}
      onKeyDown={onKeyDown}
      tabIndex={0}
      aria-label="AudFlo flow editor"
    >
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* LEFT PANEL */}
        <aside
          className="audflo-left-panel"
          style={{ width: 240, background: '#1A1820', borderRight: '1px solid #2A2730', overflowY: 'auto', flexShrink: 0 }}
        >
          <div style={{ padding: '14px 12px 8px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#A8A095', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Steps
          </div>
          {PANEL_STEPS.map(({ section, items }) => (
            <div key={section}>
              <div style={{ padding: '8px 12px 4px', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#6B6357', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {section}
              </div>
              {items.map(item => (
                <div
                  key={item}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('application/audflo-step', item);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 12px', margin: '1px 8px', borderRadius: 6,
                    cursor: 'grab', userSelect: 'none',
                    background: item === 'slack.message.new' && selectedNodeId === 'n1' ? '#2A2730' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#2A2730'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = item === 'slack.message.new' && selectedNodeId === 'n1' ? '#2A2730' : 'transparent'; }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: TYPE_COLORS[item] ?? '#6B6357', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#A8A095' }}>{item}</span>
                </div>
              ))}
            </div>
          ))}
        </aside>

        {/* CENTER CANVAS */}
        <div ref={reactFlowWrapper} style={{ flex: 1, position: 'relative', background: '#0F0E13' }}>
          {!hasNodes && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, pointerEvents: 'none' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#6B6357' }}>
                Drag a step from the left to begin.
              </span>
            </div>
          )}
          <ReactFlow
            nodes={displayNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodeContextMenu={onNodeContextMenu}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            deleteKeyCode={null}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={0.8} color="#2A2730" />
          </ReactFlow>
        </div>

        {/* RIGHT PANEL */}
        <aside
          className="audflo-right-panel"
          style={{ width: 280, background: '#1A1820', borderLeft: '1px solid #2A2730', overflowY: 'auto', flexShrink: 0 }}
        >
          <div style={{ padding: '14px 16px 8px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#A8A095', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Configure
          </div>
          {selectedNode && (
            <div style={{ padding: '4px 16px 10px', borderBottom: '1px solid #2A2730', marginBottom: 16 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: selectedNode.data.accent, textTransform: 'uppercase', marginBottom: 2 }}>
                {selectedNode.data.type}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#F5F1E8', fontFamily: 'Inter, sans-serif', marginBottom: 10 }}>
                {selectedNode.data.title}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => duplicateNode(selectedNode.id)}
                  title="Duplicate"
                  style={{
                    flex: 1, background: '#0F0E13', border: '1px solid #2A2730', borderRadius: 6,
                    color: '#A8A095', fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                    padding: '5px 0', cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#6B6357'; (e.currentTarget as HTMLButtonElement).style.color = '#F5F1E8'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2A2730'; (e.currentTarget as HTMLButtonElement).style.color = '#A8A095'; }}
                >
                  ⧉ Dupe
                </button>
                <button
                  onClick={() => disconnectNode(selectedNode.id)}
                  title="Disconnect edges"
                  style={{
                    flex: 1, background: '#0F0E13', border: '1px solid #2A2730', borderRadius: 6,
                    color: '#A8A095', fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                    padding: '5px 0', cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#6B6357'; (e.currentTarget as HTMLButtonElement).style.color = '#F5F1E8'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2A2730'; (e.currentTarget as HTMLButtonElement).style.color = '#A8A095'; }}
                >
                  ⌀ Cut
                </button>
                <button
                  onClick={() => { if (selectedNode.data.type !== 'trigger') deleteSelectedNode(selectedNode.id); }}
                  title={selectedNode.data.type === 'trigger' ? 'Cannot delete trigger' : 'Delete node'}
                  disabled={selectedNode.data.type === 'trigger'}
                  style={{
                    flex: 1, background: '#0F0E13',
                    border: `1px solid ${selectedNode.data.type === 'trigger' ? '#2A2730' : '#3A1820'}`,
                    borderRadius: 6,
                    color: selectedNode.data.type === 'trigger' ? '#3A3730' : '#E8497A',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                    padding: '5px 0',
                    cursor: selectedNode.data.type === 'trigger' ? 'not-allowed' : 'pointer',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={e => { if (selectedNode.data.type !== 'trigger') { (e.currentTarget as HTMLButtonElement).style.background = '#2A0F18'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#E8497A'; } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#0F0E13'; (e.currentTarget as HTMLButtonElement).style.borderColor = selectedNode.data.type === 'trigger' ? '#2A2730' : '#3A1820'; }}
                >
                  ⌫ Delete
                </button>
              </div>
            </div>
          )}
          <div style={{ padding: '0 16px' }}>
            {selectedConfig && selectedNodeId
              ? selectedConfig.map((field, idx) => (
                  <ConfigFieldEl
                    key={`${selectedNodeId}-${field.label}`}
                    field={field}
                    onChange={v => updateConfigField(selectedNodeId, idx, v)}
                  />
                ))
              : <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6B6357' }}>Click a node to configure it.</p>
            }
          </div>
        </aside>
      </div>

      {/* CONTROLS BAR */}
      <div style={{
        height: 56, background: '#1A1820', borderTop: '1px solid #2A2730',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', flexShrink: 0, position: 'relative',
      }}>
        <button
          onClick={() => setShowHistory(h => !h)}
          style={{ background: 'none', border: 'none', color: '#6B6357', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, cursor: 'pointer', padding: '4px 8px' }}
        >
          RUN HISTORY
        </button>

        <button
          onClick={handleRun}
          disabled={runState !== 'idle'}
          style={{
            background: 'linear-gradient(90deg,#2845D4,#7A4FE8,#E8497A,#F26B3A)',
            border: 'none', borderRadius: 999, color: '#fff',
            fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 14,
            padding: '10px 28px', cursor: runState !== 'idle' ? 'not-allowed' : 'pointer',
            opacity: runState !== 'idle' ? 0.7 : 1,
            display: 'flex', alignItems: 'center', gap: 8, transition: 'opacity 0.2s, transform 0.15s',
            transform: runState === 'idle' ? 'scale(1)' : 'scale(0.98)',
          }}
        >
          {runState === 'running' ? (
            <>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'pulseDot 0.8s ease-in-out infinite' }} />
              Running...
            </>
          ) : '▶  Run flow'}
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Reset', action: handleReset },
            { label: 'Share', action: handleShare },
            { label: 'Save', action: handleSave },
          ].map(({ label, action }) => (
            <button
              key={label}
              onClick={action}
              style={{
                background: 'transparent', border: '1px solid #2A2730', borderRadius: 999,
                color: '#A8A095', fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                padding: '5px 14px', cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#6B6357'; (e.currentTarget as HTMLButtonElement).style.color = '#F5F1E8'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2A2730'; (e.currentTarget as HTMLButtonElement).style.color = '#A8A095'; }}
            >
              {label}
            </button>
          ))}
        </div>

        {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
        {showHistory && <RunHistory onClose={() => setShowHistory(false)} />}
      </div>

      {contextMenu && (() => {
        const ctxNode = nodes.find(n => n.id === contextMenu.nodeId);
        if (!ctxNode) return null;
        return (
          <NodeContextMenu
            menu={contextMenu}
            node={ctxNode}
            onDelete={() => deleteSelectedNode(contextMenu.nodeId)}
            onDuplicate={() => duplicateNode(contextMenu.nodeId)}
            onDisconnect={() => disconnectNode(contextMenu.nodeId)}
            onClose={() => setContextMenu(null)}
          />
        );
      })()}
    </div>
  );
}

// ─── Public wrapper ───────────────────────────────────────────────────────
export default function FlowEditor() {
  return (
    <>
      <style>{`
        @keyframes pulseRing {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.03); }
        }
        @keyframes pulseDot {
          0%, 100% { transform: scale(0.8); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(16px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes fadeInDown {
          from { transform: translateY(-6px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .audflo-left-panel::-webkit-scrollbar,
        .audflo-right-panel::-webkit-scrollbar { width: 4px; }
        .audflo-left-panel::-webkit-scrollbar-track,
        .audflo-right-panel::-webkit-scrollbar-track { background: #0F0E13; }
        .audflo-left-panel::-webkit-scrollbar-thumb,
        .audflo-right-panel::-webkit-scrollbar-thumb { background: #2A2730; border-radius: 4px; }
        .react-flow__node { outline: none !important; }
        .react-flow__edge-path { cursor: default; }
        .react-flow__handle { opacity: 0; transition: opacity 0.15s; }
        .react-flow__node:hover .react-flow__handle { opacity: 1; }
      `}</style>
      <div
        className="flow-editor-desktop"
        style={{
          width: '100%', maxWidth: 1200, height: 600,
          margin: '0 auto', borderRadius: 16, overflow: 'hidden',
          border: '1px solid #2A2730', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Browser chrome */}
        <div style={{ background: '#1A1820', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderBottom: '1px solid #2A2730' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} />
          </div>
          <div style={{ flex: 1, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#A8A095' }}>
            audflo / try-it-live.flow
          </div>
          <div style={{ background: '#0F3320', border: '1px solid #28C840', borderRadius: 999, padding: '3px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#28C840', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#28C840', display: 'inline-block' }} />
            Connected to Slack (demo)
          </div>
        </div>

        {/* Editor */}
        <ReactFlowProvider>
          <FlowEditorInner />
        </ReactFlowProvider>
      </div>

      {/* Mobile fallback */}
      <div className="flow-editor-mobile" style={{ display: 'none', textAlign: 'center', padding: '24px 0' }}>
        <div style={{ background: '#1A1820', border: '1px solid #2A2730', borderRadius: 12, padding: '24px 20px', maxWidth: 400, margin: '0 auto' }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#A8A095', marginBottom: 12 }}>
            Try the full builder on desktop →
          </p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#6B6357' }}>
            The interactive flow editor is best experienced on a desktop browser.
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .flow-editor-desktop { display: none !important; }
          .flow-editor-mobile { display: block !important; }
        }
      `}</style>
    </>
  );
}

function delay(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}
