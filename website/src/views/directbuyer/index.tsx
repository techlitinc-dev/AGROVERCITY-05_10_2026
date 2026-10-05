import type { ComponentType } from 'react';
import BuyerHomeBoard from './BuyerHomeBoard';
import ContractDetailPage from './ContractDetailPage';
import ContractFormPage from './ContractFormPage';
import ContractsPage from './ContractsPage';
import DemandDetailPage from './DemandDetailPage';
import TeamPage from './TeamPage';

/**
 * Direct-buyer pages registry — maps dashboard tool ids to real
 * implementations. Deep-route pages are exported individually for App.tsx.
 */
export const DIRECT_BUYER_PAGES: Record<string, ComponentType> = {
  directBuyerHome: BuyerHomeBoard,
  contracts: ContractsPage,
  buyerTeam: TeamPage,
};

export {
  BuyerHomeBoard,
  ContractDetailPage,
  ContractFormPage,
  ContractsPage,
  DemandDetailPage,
  TeamPage,
};
