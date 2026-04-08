/**
 * SubscriptionService tests — Phase 06-02
 *
 * Covers:
 *  - client injection (server-side admin client must NOT fall through to anon singleton)
 *  - SubscriptionCheckError contract for fail-closed middleware
 *  - incrementAiUsage RPC wiring
 *  - real getTeamMemberCount via project_collaborators
 *  - getMonthlyAIUsage via get_current_ai_usage RPC
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase singleton BEFORE importing the service so we can assert
// it is never touched when an explicit client is injected.
vi.mock('../../supabase', () => {
  const fromSpy = vi.fn();
  const rpcSpy = vi.fn();
  return {
    supabase: { from: fromSpy, rpc: rpcSpy },
    createAuthenticatedClientFromLocalStorage: () => ({ from: fromSpy, rpc: rpcSpy }),
    __fromSpy: fromSpy,
    __rpcSpy: rpcSpy,
  };
});

import * as supabaseModule from '../../supabase';
import { SubscriptionService, SubscriptionCheckError } from '../subscriptionService';

const singletonFromSpy = (supabaseModule as any).__fromSpy as ReturnType<typeof vi.fn>;
const singletonRpcSpy = (supabaseModule as any).__rpcSpy as ReturnType<typeof vi.fn>;

type AnyFn = (...args: any[]) => any;

interface QueryStub {
  select: AnyFn;
  insert: AnyFn;
  update: AnyFn;
  eq: AnyFn;
  in: AnyFn;
  single: AnyFn;
}

function makeQueryStub(result: { data?: any; error?: any; count?: number }): QueryStub {
  const stub: any = {};
  const chain = () => stub;
  stub.select = vi.fn(chain);
  stub.insert = vi.fn(chain);
  stub.update = vi.fn(chain);
  stub.eq = vi.fn(chain);
  stub.in = vi.fn(chain);
  stub.single = vi.fn(() => Promise.resolve(result));
  // For head:true count queries the chain itself is awaitable
  stub.then = (resolve: AnyFn) => resolve(result);
  return stub;
}

interface MockClient {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  __tables: Record<string, any>;
}

function makeMockClient(tables: Record<string, any>, rpcImpl?: AnyFn): MockClient {
  const fromSpy = vi.fn((tableName: string) => {
    const handler = tables[tableName];
    if (typeof handler === 'function') return handler();
    return handler;
  });
  const rpcSpy = vi.fn(rpcImpl ?? (() => Promise.resolve({ data: 0, error: null })));
  return { from: fromSpy, rpc: rpcSpy, __tables: tables };
}

const FREE_SUB = { user_id: 'u1', tier: 'free', status: 'active' };

describe('SubscriptionService — client injection + fail-closed', () => {
  let svc: SubscriptionService;

  beforeEach(() => {
    svc = new SubscriptionService();
    singletonFromSpy.mockReset();
    singletonRpcSpy.mockReset();
  });

  // ---- Test 7: getSubscription uses injected client, not singleton ----
  it('getSubscription with injected client uses it and never the singleton', async () => {
    const client = makeMockClient({
      subscriptions: () => makeQueryStub({ data: FREE_SUB, error: null }),
    });
    const sub = await svc.getSubscription('u1', client as any);
    expect(sub).toEqual(FREE_SUB);
    expect(client.from).toHaveBeenCalledWith('subscriptions');
    expect(singletonFromSpy).not.toHaveBeenCalled();
  });

  // ---- Test 8: checkLimit propagates injected client to internal helpers ----
  it('checkLimit forwards injected client to all helpers (projects)', async () => {
    const client = makeMockClient({
      subscriptions: () => makeQueryStub({ data: FREE_SUB, error: null }),
      projects: () => makeQueryStub({ count: 0, error: null }),
    });
    const result = await svc.checkLimit('u1', 'projects', client as any);
    expect(result.canUse).toBe(true);
    expect(result.current).toBe(0);
    expect(result.limit).toBe(1);
    expect(client.from).toHaveBeenCalledWith('projects');
    expect(singletonFromSpy).not.toHaveBeenCalled();
  });

  it('checkLimit ai_ideas forwards injected client to get_current_ai_usage RPC', async () => {
    const client = makeMockClient(
      {
        subscriptions: () => makeQueryStub({ data: FREE_SUB, error: null }),
      },
      (name: string) => {
        if (name === 'get_current_ai_usage') return Promise.resolve({ data: 2, error: null });
        return Promise.resolve({ data: null, error: { message: 'unexpected rpc' } });
      }
    );
    const result = await svc.checkLimit('u1', 'ai_ideas', client as any);
    expect(client.rpc).toHaveBeenCalledWith('get_current_ai_usage', { p_user_id: 'u1' });
    expect(result.current).toBe(2);
    expect(result.canUse).toBe(true);
    expect(singletonRpcSpy).not.toHaveBeenCalled();
  });

  // ---- Test 9: incrementAiUsage uses injected client ----
  it('incrementAiUsage calls increment_ai_usage RPC on injected client', async () => {
    const client = makeMockClient(
      {},
      (name: string) => Promise.resolve({ data: name === 'increment_ai_usage' ? 3 : null, error: null })
    );
    const next = await svc.incrementAiUsage('u1', client as any);
    expect(next).toBe(3);
    expect(client.rpc).toHaveBeenCalledWith('increment_ai_usage', { p_user_id: 'u1' });
    expect(singletonRpcSpy).not.toHaveBeenCalled();
  });

  it('incrementAiUsage propagates RPC errors as SubscriptionCheckError', async () => {
    const client = makeMockClient({}, () => Promise.resolve({ data: null, error: { message: 'boom' } }));
    await expect(svc.incrementAiUsage('u1', client as any)).rejects.toBeInstanceOf(SubscriptionCheckError);
  });

  // ---- Test 5: checkLimit wraps unexpected DB errors as SubscriptionCheckError ----
  it('checkLimit wraps DB errors as SubscriptionCheckError', async () => {
    const client = makeMockClient({
      subscriptions: () => makeQueryStub({ data: null, error: { code: 'XX000', message: 'db down' } }),
    });
    await expect(svc.checkLimit('u1', 'projects', client as any)).rejects.toBeInstanceOf(SubscriptionCheckError);
  });

  // ---- Tests 3 & 4: getTeamMemberCount real query ----
  it('checkLimit users returns real collaborator count (not stub of 1)', async () => {
    const projectsStub = makeQueryStub({ data: [{ id: 'p1' }, { id: 'p2' }], error: null });
    // For team count we need .select then .in then await — use a count-shaped resolver:
    const collabStub: any = {
      select: vi.fn(function (this: any) { return this; }),
      in: vi.fn(function (this: any) { return Promise.resolve({ count: 4, error: null }); }),
    };
    const client = makeMockClient({
      subscriptions: () => makeQueryStub({ data: FREE_SUB, error: null }),
      projects: () => projectsStub,
      project_collaborators: () => collabStub,
    });
    const result = await svc.checkLimit('u1', 'users', client as any);
    expect(result.current).toBe(4);
    expect(result.limit).toBe(3);
    expect(result.canUse).toBe(false);
    expect(client.from).toHaveBeenCalledWith('project_collaborators');
  });

  it('getTeamMemberCount returns 0 when user owns no projects', async () => {
    const client = makeMockClient({
      subscriptions: () => makeQueryStub({ data: FREE_SUB, error: null }),
      projects: () => makeQueryStub({ data: [], error: null }),
    });
    const result = await svc.checkLimit('u1', 'users', client as any);
    expect(result.current).toBe(0);
  });

  // ---- Test 10: default behavior preserved when no client passed ----
  it('falls back to singleton/getClient when no client is injected', async () => {
    const stub = makeQueryStub({ data: FREE_SUB, error: null });
    singletonFromSpy.mockReturnValue(stub);
    const sub = await svc.getSubscription('u1');
    expect(sub).toEqual(FREE_SUB);
    expect(singletonFromSpy).toHaveBeenCalledWith('subscriptions');
  });
});
