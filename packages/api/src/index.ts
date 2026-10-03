/**
 * The data layer: the DummyJSON client, the todo↔Job mapping, the write overlay and the query hooks.
 * Screens import from here and from nowhere deeper — `client.ts` and `overlay.ts` are the seams the
 * tests drive, not the surface a screen is meant to reach for.
 */
export { ApiError, API_BASE_URL, PAGE_SIZE, createTodo, fetchTodoPage, fetchUserTodos } from './client';
export { toJob, toTodoBody } from './map';
export { applyOverlay, applyOverlayToPages, prepareRows } from './overlay';
export { createQueryClient, jobKeys } from './queryClient';
export { ApiErrorSchema, TodoListSchema, TodoSchema, type Todo, type TodoList } from './schemas';
export { availableScope, clientScope } from './scopes';
export { useAvailableJobs, useClientJobs, useCreateJob } from './useJobs';
