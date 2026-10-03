/**
 * The API boundary, as pure functions. DummyJSON is a third party we do not control, so every
 * response is parsed before it is mapped — this suite is what makes a shape change upstream a caught
 * error with a message rather than `undefined.todo` three components deep.
 */
import { ApiErrorSchema, TodoListSchema, TodoSchema } from './schemas';

const todo = { id: 1, todo: 'Kitchen tap drips constantly', completed: false, userId: 26 };

it('accepts a todo in the shape the live API sends', () => {
  expect(TodoSchema.parse(todo)).toEqual(todo);
});

it('rejects a todo whose id arrived as a string, rather than coercing it', () => {
  expect(TodoSchema.safeParse({ ...todo, id: '1' }).success).toBe(false);
});

it('rejects a todo with the title field renamed, which is the shape change we fear', () => {
  const { todo: title, ...rest } = todo;
  expect(TodoSchema.safeParse({ ...rest, text: title }).success).toBe(false);
});

it('rejects a todo missing `completed`, because status would otherwise be invented', () => {
  const { completed, ...rest } = todo;
  expect(completed).toBe(false);
  expect(TodoSchema.safeParse(rest).success).toBe(false);
});

it('accepts the envelope every list endpoint shares, and keeps `total`', () => {
  expect(TodoListSchema.parse({ todos: [todo], total: 254, skip: 0, limit: 20 })).toEqual({
    todos: [todo],
    total: 254,
    skip: 0,
    limit: 20,
  });
});

it('rejects an envelope with no `total`, because that is what stops the pagination', () => {
  expect(TodoListSchema.safeParse({ todos: [todo], skip: 0, limit: 20 }).success).toBe(false);
});

it('rejects an envelope holding one malformed row rather than mapping the good ones', () => {
  const malformed = { todos: [todo, { id: 2 }], total: 254, skip: 0, limit: 20 };

  expect(TodoListSchema.safeParse(malformed).success).toBe(false);
});

it('reads the message off an error body, which is JSON here too', () => {
  expect(ApiErrorSchema.parse({ message: "Todo with id '9999' not found" })).toEqual({
    message: "Todo with id '9999' not found",
  });
});

it('rejects an error body with no message, so the caller falls back rather than showing undefined', () => {
  expect(ApiErrorSchema.safeParse({ error: 'nope' }).success).toBe(false);
});
