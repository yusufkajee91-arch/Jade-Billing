'use client'

import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Eye, EyeOff } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  WIDGET_DEFS,
  DEFAULT_LEFT,
  DEFAULT_RIGHT,
  type WidgetId,
  type WidgetPrefs,
} from '@/components/dashboard/dashboard-shell'

// ─── Single sortable item ──────────────────────────────────────────────────────

function PanelItem({
  id,
  label,
  hidden,
  onToggle,
}: {
  id: WidgetId
  label: string
  hidden: boolean
  onToggle: (id: WidgetId) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? 'background 0.15s',
        opacity: isDragging ? 0.4 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 10,
        background: isDragging ? 'rgba(176, 139, 130, 0.08)' : 'transparent',
      }}
      className="hover:bg-[rgba(74,72,69,0.04)]"
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing flex-shrink-0"
        style={{ color: '#D8D3CB' }}
        aria-label="Drag to reorder"
      >
        <GripVertical style={{ width: 16, height: 16 }} />
      </button>
      <span
        style={{
          flex: 1,
          fontFamily: 'var(--font-noto-sans)',
          fontSize: 14,
          color: hidden ? '#80796F' : '#2C2C2A',
        }}
      >
        {label}
      </span>
      <button
        onClick={() => onToggle(id)}
        style={{ color: hidden ? '#D8D3CB' : '#B08B82', flexShrink: 0 }}
        className="transition-colors"
        title={hidden ? 'Show widget' : 'Hide widget'}
      >
        {hidden ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
      </button>
    </div>
  )
}

// ─── Zone list ─────────────────────────────────────────────────────────────────

function ZoneList({
  title,
  order,
  hidden,
  onDragEnd,
  onToggle,
}: {
  title: string
  order: WidgetId[]
  hidden: WidgetId[]
  onDragEnd: (event: DragEndEvent) => void
  onToggle: (id: WidgetId) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  return (
    <div>
      <p
        style={{
          fontFamily: 'var(--font-noto-sans)',
          fontSize: 9,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#80796F',
          padding: '0 12px',
          marginBottom: 4,
        }}
      >
        {title}
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div>
            {order.map((id) => (
              <PanelItem
                key={id}
                id={id}
                label={WIDGET_DEFS[id].label}
                hidden={hidden.includes(id)}
                onToggle={onToggle}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

// ─── Panel ─────────────────────────────────────────────────────────────────────

export function CustomisePanel({
  open,
  onOpenChange,
  prefs,
  isAdmin,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefs: WidgetPrefs
  isAdmin: boolean
  onSave: (prefs: WidgetPrefs) => void
}) {
  const [localLeft, setLocalLeft] = useState<WidgetId[]>(prefs.leftOrder)
  const [localRight, setLocalRight] = useState<WidgetId[]>(prefs.rightOrder)
  const [localHidden, setLocalHidden] = useState<WidgetId[]>(prefs.hidden)

  const [prevPrefs, setPrevPrefs] = useState(prefs)
  if (prefs !== prevPrefs) {
    setPrevPrefs(prefs)
    setLocalLeft(prefs.leftOrder)
    setLocalRight(prefs.rightOrder)
    setLocalHidden(prefs.hidden)
  }

  function handleDragLeft(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setLocalLeft((prev) => {
      const oi = prev.indexOf(active.id as WidgetId)
      const ni = prev.indexOf(over.id as WidgetId)
      return arrayMove(prev, oi, ni)
    })
  }

  function handleDragRight(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setLocalRight((prev) => {
      const oi = prev.indexOf(active.id as WidgetId)
      const ni = prev.indexOf(over.id as WidgetId)
      return arrayMove(prev, oi, ni)
    })
  }

  function toggleHidden(id: WidgetId) {
    setLocalHidden((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id],
    )
  }

  function handleSave() {
    onSave({ leftOrder: localLeft, rightOrder: localRight, hidden: localHidden })
    onOpenChange(false)
  }

  function handleReset() {
    setLocalLeft(DEFAULT_LEFT)
    setLocalRight(DEFAULT_RIGHT)
    setLocalHidden([])
    onSave({ leftOrder: DEFAULT_LEFT, rightOrder: DEFAULT_RIGHT, hidden: [] })
    onOpenChange(false)
  }

  const leftVisible = localLeft.filter((id) => !WIDGET_DEFS[id].adminOnly || isAdmin)
  const rightVisible = localRight.filter((id) => !WIDGET_DEFS[id].adminOnly || isAdmin)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-xs">
        <SheetHeader style={{ padding: '20px 24px', borderBottom: '1px solid #D8D3CB' }}>
          <SheetTitle style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400, color: '#2C2C2A' }}>
            Customise Dashboard
          </SheetTitle>
        </SheetHeader>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 8px' }} className="space-y-6">
          <ZoneList
            title="Left Column"
            order={leftVisible}
            hidden={localHidden}
            onDragEnd={handleDragLeft}
            onToggle={toggleHidden}
          />
          <ZoneList
            title="Right Column"
            order={rightVisible}
            hidden={localHidden}
            onDragEnd={handleDragRight}
            onToggle={toggleHidden}
          />
        </div>

        <div style={{ borderTop: '1px solid #D8D3CB', padding: '16px 24px', display: 'flex', gap: 12 }}>
          <button
            onClick={handleReset}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 8,
              border: '1px solid #D8D3CB',
              fontFamily: 'var(--font-noto-sans)',
              fontSize: 13,
              color: '#80796F',
              background: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            className="hover:bg-[rgba(74,72,69,0.04)]"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 8,
              background: '#B08B82',
              fontFamily: 'var(--font-noto-sans)',
              fontSize: 13,
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            className="hover:bg-[#93706A]"
          >
            Save
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
