"use client";

import { create } from "zustand";

interface UIState {
  isMobileMenuOpen: boolean;
  isCreateModalOpen: boolean;
  createModalType: "vault" | "marketplace" | "quest" | null;

  // Actions
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  openCreateModal: (type: "vault" | "marketplace" | "quest") => void;
  closeCreateModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isMobileMenuOpen: false,
  isCreateModalOpen: false,
  createModalType: null,

  toggleMobileMenu: () =>
    set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),

  closeMobileMenu: () => set({ isMobileMenuOpen: false }),

  openCreateModal: (type) =>
    set({ isCreateModalOpen: true, createModalType: type }),

  closeCreateModal: () =>
    set({ isCreateModalOpen: false, createModalType: null }),
}));
