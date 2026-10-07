// Draft MCP tools implementation for PlacePrep.
// NOTE: Kept for subsequent phases (Phase 3/4/8) and NOT registered in Phase 2.
// In Phase 2, the MCP server is strictly closed-by-default.

import { z } from 'zod';
import authService from '../services/auth.service.js';
import userProfileService from '../services/userProfile.service.js';
import progressService from '../services/progress.service.js';
import taskService from '../services/task.service.js';

export function registerDraftTools(server, user) {
  server.registerTool(
    'get_profile',
    {
      description:
        "Retrieve the authenticated student's placement preparation profile, target role, placement deadline, current streak, readiness score, consistency score, and topic strengths.",
    },
    async () => {
      const profile = await authService.getProfile(user.id);
      const socialProfile = await userProfileService.getProfile(user);

      const safeProfile = {
        name: profile.name,
        targetRole: profile.targetRole || 'Software Development Engineer',
        placementDate: profile.placementDate,
        readinessScore: Number(profile.readinessScore || 0),
        consistencyScore: Number(profile.consistencyScore || 0),
        currentStreak: Number(profile.currentStreak || 0),
        solvedProblems: Number(profile.solvedProblems || 0),
        averageTimePerProblem: Number(profile.averageTimePerProblem || 0),
        weakAreas: profile.weakAreas || [],
        strongTopics: profile.strongTopics || [],
        leetcodeUrl: socialProfile?.leetcodeUrl || null,
        githubUrl: socialProfile?.githubUrl || null,
        timezone: profile.timezone,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(safeProfile, null, 2) }],
      };
    }
  );

  server.registerTool(
    'get_progress_summary',
    {
      description:
        "Retrieve the authenticated student's placement readiness analytics, topic strengths, and AI coach directive.",
    },
    async () => {
      const summary = await progressService.getSummary(user);
      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
      };
    }
  );

  server.registerTool(
    'get_tasks',
    {
      description:
        "List placement preparation tasks for the authenticated student.",
      inputSchema: z.object({
        date: z.string().optional().describe("Date filter: 'today' or specific 'YYYY-MM-DD' date"),
        status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).optional().describe('Task status filter'),
        category: z.enum(['DSA', 'Core', 'Project', 'Aptitude', 'Resume', 'MockInterview', 'Other']).optional().describe('Task category filter'),
      }),
    },
    async (args) => {
      const tasks = await taskService.listTasks(user, {
        date: args.date,
        status: args.status,
        category: args.category,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify({ count: tasks.length, tasks }, null, 2) }],
      };
    }
  );

  server.registerTool(
    'get_task',
    {
      description:
        "Retrieve details of a specific placement preparation task owned by the authenticated student by its task ID.",
      inputSchema: z.object({
        taskId: z.string().uuid().describe('Unique ID of the task to retrieve'),
      }),
    },
    async (args) => {
      const task = await taskService.getTask(user, args.taskId);
      return {
        content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
      };
    }
  );

  server.registerTool(
    'create_task',
    {
      description:
        "Persist a confirmed placement preparation task for the authenticated student.",
      inputSchema: z.object({
        title: z.string().min(2).max(180).describe('Specific title of the task'),
        category: z.enum(['DSA', 'Core', 'Project', 'Aptitude', 'Resume', 'MockInterview', 'Other']).describe('Subject category'),
        difficulty: z.number().int().min(1).max(5).default(3).describe('Difficulty level from 1 to 5'),
        estimatedMinutes: z.number().int().min(5).max(480).default(30).describe('Estimated duration in minutes'),
        priority: z.enum(['low', 'medium', 'high']).default('medium').describe('Priority level'),
        scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Scheduled date in YYYY-MM-DD format'),
        description: z.string().optional().describe('Optional task instructions'),
      }),
    },
    async (args) => {
      const lower = args.title.trim().toLowerCase();
      if (['new task', 'task', 'untitled', 'todo', 'a task'].includes(lower)) {
        throw new Error('Please provide a specific task title instead of a generic placeholder.');
      }

      const created = await taskService.createTask(user, {
        title: args.title.trim(),
        category: args.category,
        difficulty: args.difficulty,
        estimatedMinutes: args.estimatedMinutes,
        priority: args.priority,
        scheduledFor: args.scheduledFor,
        description: args.description,
      });

      return {
        content: [
          {
            type: 'text',
            text: `✅ Task created successfully!\nID: ${created.id}\nTitle: "${created.title}"\nCategory: ${created.category}\nScheduled: ${created.scheduledFor}\nDuration: ${created.estimatedMinutes} mins`,
          },
        ],
      };
    }
  );

  server.registerTool(
    'update_task_status',
    {
      description:
        "Update the completion status ('pending', 'in_progress', 'completed', 'skipped') of an existing preparation task owned by the student.",
      inputSchema: z.object({
        taskId: z.string().uuid().describe('Unique ID of the task to update'),
        status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).describe('New status for the task'),
        actualMinutes: z.number().int().min(0).max(480).optional().describe('Actual minutes spent on the task'),
      }),
    },
    async (args) => {
      const updated = await taskService.updateTask(user, args.taskId, {
        status: args.status,
        actualMinutes: args.actualMinutes,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Updated task "${updated.title}" status to "${updated.status}".`,
          },
        ],
      };
    }
  );

  server.registerTool(
    'delete_task',
    {
      description:
        "Permanently delete a preparation task owned by the authenticated student.",
      inputSchema: z.object({
        taskId: z.string().uuid().describe('Unique ID of the task to delete'),
      }),
    },
    async (args) => {
      const deleted = await taskService.deleteTask(user, args.taskId);
      return {
        content: [
          {
            type: 'text',
            text: `Deleted task "${deleted.title}" (ID: ${deleted.id}).`,
          },
        ],
      };
    }
  );
}
