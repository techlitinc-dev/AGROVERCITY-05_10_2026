import type { ComponentType } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import EquipmentOwnerHomeBoard from './EquipmentOwnerHomeBoard';

export const EQUIPMENT_PAGES: Record<string, ComponentType> = {
  machineManage: () => (
    <ToolShell toolId="machineManage">
      <EquipmentOwnerHomeBoard embedded />
    </ToolShell>
  ),
  slotCalendarManage: () => (
    <ToolShell toolId="slotCalendarManage">
      <EquipmentOwnerHomeBoard embedded />
    </ToolShell>
  ),
  equipmentOwnerHome: () => (
    <ToolShell toolId="equipmentOwnerHome">
      <EquipmentOwnerHomeBoard embedded />
    </ToolShell>
  ),
};

export { EquipmentOwnerHomeBoard };
