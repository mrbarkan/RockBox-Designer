
import { ProjectState, User, CloudProject } from '../types';
import { parseProjectData, stringifyProjectData } from './projectSerialization';

/**
 * MOCK SERVER SERVICE
 * 
 * In a real application, these functions would be `fetch` calls to your API 
 * (Node.js, Supabase, Firebase, etc).
 * 
 * We use localStorage here to simulate a server so the app functions as requested
 * without needing an actual backend deployed.
 */

const USERS_KEY = 'rockbox_users';
const PROJECTS_PREFIX = 'rockbox_projects_';
const SESSION_KEY = 'rockbox_session';

export const storageService = {
  
  // --- AUTHENTICATION ---

  login: async (username: string): Promise<User> => {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 500));

    const usersStr = localStorage.getItem(USERS_KEY);
    const users: Record<string, User> = usersStr ? JSON.parse(usersStr) : {};

    if (users[username]) {
      localStorage.setItem(SESSION_KEY, username);
      return users[username];
    } else {
      throw new Error("User not found. Please register.");
    }
  },

  register: async (username: string): Promise<User> => {
    await new Promise(r => setTimeout(r, 500));

    if (!username || username.length < 3) throw new Error("Username too short");

    const usersStr = localStorage.getItem(USERS_KEY);
    const users: Record<string, User> = usersStr ? JSON.parse(usersStr) : {};

    if (users[username]) {
      throw new Error("User already exists");
    }

    const newUser: User = { username, created: Date.now() };
    users[username] = newUser;
    
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    localStorage.setItem(SESSION_KEY, username);
    
    return newUser;
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
  },

  getSession: (): User | null => {
    const username = localStorage.getItem(SESSION_KEY);
    if (!username) return null;
    
    const usersStr = localStorage.getItem(USERS_KEY);
    const users = usersStr ? JSON.parse(usersStr) : {};
    return users[username] || null;
  },

  // --- PROJECT MANAGEMENT ---

  saveProject: async (user: User, project: ProjectState): Promise<CloudProject> => {
    await new Promise(r => setTimeout(r, 800));

    const key = `${PROJECTS_PREFIX}${user.username}`;
    const projectsStr = localStorage.getItem(key);
    let projects: CloudProject[] = projectsStr ? parseProjectData(projectsStr) : [];

    // Check if project exists (match by name for simplicity in this mock)
    // In real app, we'd use a unique project ID in settings
    const existingIndex = projects.findIndex(p => p.name === project.settings.name);
    
    const newEntry: CloudProject = {
      id: existingIndex >= 0 ? projects[existingIndex].id : Math.random().toString(36).substr(2, 9),
      name: project.settings.name,
      updated: Date.now(),
      data: project
    };

    if (existingIndex >= 0) {
      projects[existingIndex] = newEntry;
    } else {
      projects.push(newEntry);
    }

    try {
        localStorage.setItem(key, stringifyProjectData(projects));
    } catch (e) {
        throw new Error("Storage full! Project contains too many large images.");
    }

    return newEntry;
  },

  listProjects: async (user: User): Promise<CloudProject[]> => {
    await new Promise(r => setTimeout(r, 400));
    
    const key = `${PROJECTS_PREFIX}${user.username}`;
    const projectsStr = localStorage.getItem(key);
    return projectsStr ? parseProjectData(projectsStr) : [];
  },

  deleteProject: async (user: User, projectId: string): Promise<void> => {
     const key = `${PROJECTS_PREFIX}${user.username}`;
     const projectsStr = localStorage.getItem(key);
     let projects: CloudProject[] = projectsStr ? parseProjectData(projectsStr) : [];
     
     projects = projects.filter(p => p.id !== projectId);
     localStorage.setItem(key, stringifyProjectData(projects));
  }
};
