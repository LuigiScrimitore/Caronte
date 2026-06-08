import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAppStore = create(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      
      isSidebarOpen: true,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      
      activeProjectId: null,
      setActiveProjectId: (id) => {
        set({ activeProjectId: id });
        window.location.reload(); // Forza reload allo switch
      },
      
      projects: [],
      fetchProjects: async () => {
        try {
          const res = await fetch('http://localhost:8000/api/v1/projects');
          if (res.ok) {
            const data = await res.json();
            set({ projects: data });
            if (data.length > 0 && !get().activeProjectId) {
              set({ activeProjectId: data[0].id });
            }
          }
        } catch (error) {
          console.error("Failed to fetch projects", error);
        }
      }
    }),
    {
      name: 'caronte-storage',
    }
  )
);
