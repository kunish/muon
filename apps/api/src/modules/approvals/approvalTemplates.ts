import type { ApprovalTemplate } from '@muon/enterprise-contracts'

/** 内置审批模板（飞书常见类型）。结构化表单 + 默认审批链。 */
export const BUILT_IN_APPROVAL_TEMPLATES: ApprovalTemplate[] = [
  {
    id: 'leave',
    name: '请假',
    description: '请假申请（事假/病假/年假等）',
    stages: ['主管审批', '人事备案'],
    fields: [
      {
        key: 'leaveType',
        label: '请假类型',
        type: 'select',
        required: true,
        options: ['事假', '病假', '年假', '调休'],
      },
      { key: 'startDate', label: '开始日期', type: 'date', required: true },
      { key: 'endDate', label: '结束日期', type: 'date', required: true },
      { key: 'reason', label: '请假事由', type: 'textarea', required: true },
    ],
  },
  {
    id: 'reimbursement',
    name: '报销',
    description: '费用报销申请',
    stages: ['主管审批', '财务审批'],
    fields: [
      { key: 'category', label: '费用类别', type: 'select', required: true, options: ['差旅', '招待', '办公', '其他'] },
      { key: 'amount', label: '报销金额', type: 'number', required: true },
      { key: 'occurredOn', label: '发生日期', type: 'date', required: true },
      { key: 'detail', label: '费用说明', type: 'textarea', required: true },
    ],
  },
  {
    id: 'purchase',
    name: '采购',
    description: '采购申请',
    stages: ['主管审批', '采购审批', '财务审批'],
    fields: [
      { key: 'item', label: '采购物品', type: 'text', required: true },
      { key: 'quantity', label: '数量', type: 'number', required: true },
      { key: 'budget', label: '预算金额', type: 'number', required: true },
      { key: 'justification', label: '采购理由', type: 'textarea', required: true },
    ],
  },
  {
    id: 'overtime',
    name: '加班',
    description: '加班申请',
    stages: ['主管审批'],
    fields: [
      { key: 'date', label: '加班日期', type: 'date', required: true },
      { key: 'hours', label: '加班时长（小时）', type: 'number', required: true },
      { key: 'reason', label: '加班事由', type: 'textarea', required: true },
    ],
  },
]

export function findApprovalTemplate(id: string): ApprovalTemplate | undefined {
  return BUILT_IN_APPROVAL_TEMPLATES.find((template) => template.id === id)
}
