'use strict';

/**
 * The approver's inbox ordered by a CPU-scheduling policy, through the real API.
 */

jest.mock('../../src/services/mail/mailer');

const live = require('../helpers/liveApp');
const tw = require('../../src/services/scheduling/timeWindow');

const { request, db, describeWithDb } = live;

describeWithDb('approval inbox scheduling (database)', () => {
  let app;
  let principal;
  let itCoordinator;
  let csCoordinator;
  let gaurav;
  let student;
  let clubId;
  const auth = (s) => ({ Authorization: `Bearer ${s.accessToken}` });
  const day = (n) => tw.addDays(tw.campusToday(), n);
  const mine = {}; // label -> booking id

  async function newVenue() {
    const res = await request(app).post('/api/venues').set(auth(principal)).send({
      name: `Inbox Hall ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      building: 'Inbox Block', floor: 1, type: 'SEMINAR_HALL', capacity: 120,
    }).expect(201);
    return res.body.data.id;
  }

  async function submit(label, { venueId, date }) {
    const res = await request(app).post('/api/bookings').set(auth(gaurav)).send({
      venueId, clubId, title: `Inbox ${label}`, category: 'TECHNICAL', expectedAttendance: 40,
      date, startTime: '10:00', endTime: '12:00',
    }).expect(201);
    mine[label] = res.body.data.id;
  }

  const inbox = (session, query = {}) => request(app).get('/api/bookings/inbox').query(query).set(auth(session));
  /** My requests only, in the order the policy served them. */
  const myOrder = (body) => body.data.items.filter((i) => Object.values(mine).includes(i.id))
    .map((i) => Object.keys(mine).find((k) => mine[k] === i.id));

  beforeAll(async () => {
    app = live.createApp();
    [principal, itCoordinator, csCoordinator, gaurav, student] = await Promise.all([
      live.signIn(app, 'principal@mmcoe.edu.in'),
      live.signIn(app, 'coordinator.it@mmcoe.edu.in'),
      live.signIn(app, 'coordinator.cs@mmcoe.edu.in'),
      live.signIn(app, 'gaurav.jadhav@mmcoe.edu.in'),
      live.signIn(app, 'srushti.mane@mmcoe.edu.in'),
    ]);
    ({ rows: [{ club_id: clubId }] } = await db.query(`SELECT club_id FROM clubs WHERE club_name = 'IT Tech Club'`));

    // Three requests fight over one slot (so each has 2 competitors, a longer review),
    // then two uncontested ones: Y starts later than Z. Submitted in this order.
    const contested = await newVenue();
    await submit('X1', { venueId: contested, date: day(40) });
    await submit('X2', { venueId: contested, date: day(40) });
    await submit('X3', { venueId: contested, date: day(40) });
    await submit('Y', { venueId: await newVenue(), date: day(41) });
    await submit('Z', { venueId: await newVenue(), date: day(39) });
  });

  afterAll(async () => {
    await db.closePool();
  });

  it('FCFS serves requests in the order they were submitted', async () => {
    const res = await inbox(itCoordinator, { policy: 'fcfs' }).expect(200);
    expect(res.body.data.policy).toBe('fcfs');
    expect(myOrder(res.body)).toEqual(['X1', 'X2', 'X3', 'Y', 'Z']);
  });

  it('is FCFS when no policy is given', async () => {
    const res = await inbox(itCoordinator).expect(200);
    expect(res.body.data.policy).toBe('fcfs');
    expect(myOrder(res.body)).toEqual(['X1', 'X2', 'X3', 'Y', 'Z']);
  });

  it('SJF serves the quickest reviews first: the two uncontested ones before the contested three', async () => {
    const res = await inbox(itCoordinator, { policy: 'sjf' }).expect(200);
    expect(myOrder(res.body)).toEqual(['Y', 'Z', 'X1', 'X2', 'X3']);
  });

  it('priority serves the soonest event first', async () => {
    const res = await inbox(itCoordinator, { policy: 'priority' }).expect(200);
    // Z is on day 39, the contested slot on day 40, Y on day 41.
    expect(myOrder(res.body)).toEqual(['Z', 'X1', 'X2', 'X3', 'Y']);
  });

  it('models a contested request as a longer review, from the stated assumptions', async () => {
    const res = await inbox(itCoordinator).expect(200);
    const byLabel = Object.fromEntries(res.body.data.items.filter((i) => Object.values(mine).includes(i.id))
      .map((i) => [Object.keys(mine).find((k) => mine[k] === i.id), i]));
    expect(byLabel.X1).toMatchObject({ competingRequests: 2, reviewMinutes: 15 }); // 5 + 5 x 2
    expect(byLabel.Y).toMatchObject({ competingRequests: 0, reviewMinutes: 5 });
    expect(res.body.data.assumptions).toMatchObject({ baseMinutes: 5, perCompetitorMinutes: 5 });
    expect(res.body.data.assumptions.note).toMatch(/modelled, not measured/);
  });

  it('lets the assumptions be changed, and reports them back', async () => {
    const res = await inbox(itCoordinator, { baseMinutes: 10, perCompetitorMinutes: 0 }).expect(200);
    expect(res.body.data.assumptions).toMatchObject({ baseMinutes: 10, perCompetitorMinutes: 0 });
    expect(res.body.data.items.every((i) => i.reviewMinutes === 10)).toBe(true);
  });

  it('projects waiting and turnaround times that add up', async () => {
    const res = await inbox(itCoordinator, { policy: 'sjf' }).expect(200);
    const { items } = res.body.data;
    expect(items.map((i) => i.position)).toEqual(items.map((_, index) => index + 1));
    for (const item of items) {
      expect(item.projectedWaitMinutes).toBeGreaterThanOrEqual(0);
      expect(item.projectedTurnaroundMinutes).toBeCloseTo(item.projectedWaitMinutes + item.reviewMinutes, 0);
    }
  });

  it('compares all three policies on the same queue, with SJF never waiting longer on average than FCFS', async () => {
    const res = await inbox(itCoordinator).expect(200);
    const { comparison } = res.body.data;
    expect(Object.keys(comparison).sort()).toEqual(['fcfs', 'priority', 'sjf']);
    for (const stats of Object.values(comparison)) {
      expect(stats.averageWaitMinutes).toBeGreaterThanOrEqual(0);
      expect(stats.averageTurnaroundMinutes).toBeGreaterThanOrEqual(stats.averageWaitMinutes);
    }
    // Everything in the inbox has already arrived, so SJF's average wait is provably the smallest.
    expect(comparison.sjf.averageWaitMinutes).toBeLessThanOrEqual(comparison.fcfs.averageWaitMinutes);
    expect(comparison.sjf.averageWaitMinutes).toBeLessThanOrEqual(comparison.priority.averageWaitMinutes);
  });

  it('reports how many requests there are and how many it considered', async () => {
    const res = await inbox(itCoordinator).expect(200);
    expect(res.body.data.total).toBeGreaterThanOrEqual(5);
    expect(res.body.data.considered).toBe(res.body.data.items.length);
    expect(res.body.data.considered).toBeLessThanOrEqual(100);
  });

  it('is scoped like the decisions view: the principal sees them, another department\'s coordinator does not', async () => {
    const asPrincipal = await inbox(principal).expect(200);
    expect(myOrder(asPrincipal.body)).toHaveLength(5);
    const asCs = await inbox(csCoordinator).expect(200);
    expect(myOrder(asCs.body)).toHaveLength(0);
  });

  it('is closed to students and club heads, and needs sign-in', async () => {
    await inbox(student).expect(403);
    await inbox(gaurav).expect(403);
    await request(app).get('/api/bookings/inbox').expect(401);
  });

  it('rejects an unknown policy and out-of-range assumptions', async () => {
    await inbox(itCoordinator, { policy: 'lottery' }).expect(422);
    await inbox(itCoordinator, { baseMinutes: 0 }).expect(422);
    await inbox(itCoordinator, { baseMinutes: 500 }).expect(422);
    await inbox(itCoordinator, { perCompetitorMinutes: -1 }).expect(422);
  });

  it('is not shadowed by the /:id route', async () => {
    const res = await inbox(itCoordinator).expect(200);
    expect(res.body.data).toHaveProperty('comparison');
  });
});
