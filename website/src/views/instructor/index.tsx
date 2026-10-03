import type { ComponentType } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import InstructorHomeBoard from './InstructorHomeBoard';

export const INSTRUCTOR_PAGES: Record<string, ComponentType> = {
  instructorHome: () => (
    <ToolShell toolId="instructorHome">
      <InstructorHomeBoard embedded />
    </ToolShell>
  ),
  courses: () => (
    <ToolShell toolId="courses">
      <InstructorHomeBoard embedded />
    </ToolShell>
  ),
};

export { InstructorHomeBoard };
