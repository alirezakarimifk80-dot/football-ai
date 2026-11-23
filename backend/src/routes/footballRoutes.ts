import { Router } from 'express';
import { footballController } from '../controllers/footballController.ts';
import { footballApiErrorHandler } from '../middleware/errorHandler.ts';
import { requireIntParam } from '../middleware/validateRequest.ts';

export const footballV1Router = Router();

// Real-time Server-Sent Events stream
footballV1Router.get('/stream/live', footballController.streamLive);

// A. Live scores
footballV1Router.get('/live', footballController.getLive);

// B. Fixtures & H2H
footballV1Router.get('/fixtures', footballController.getFixtures);
footballV1Router.get('/fixtures/h2h', footballController.getHeadToHead);
footballV1Router.get('/fixtures/:id', requireIntParam('id'), footballController.getFixtureById);
footballV1Router.get('/fixtures/:id/full', requireIntParam('id'), footballController.getFixtureFull);

// C, D, E. Match Events, Statistics, Lineups
footballV1Router.get('/fixtures/:id/events', requireIntParam('id'), footballController.getFixtureEvents);
footballV1Router.get('/fixtures/:id/statistics', requireIntParam('id'), footballController.getFixtureStatistics);
footballV1Router.get('/fixtures/:id/lineups', requireIntParam('id'), footballController.getFixtureLineups);
footballV1Router.get('/fixtures/:id/predictions', requireIntParam('id'), footballController.getPredictions);

// F. Leagues & Standings
footballV1Router.get('/leagues', footballController.getLeagues);
footballV1Router.get('/leagues/:id/standings', requireIntParam('id'), footballController.getStandings);
footballV1Router.get('/leagues/:id/top-scorers', requireIntParam('id'), footballController.getTopScorers);
footballV1Router.get('/leagues/:id/top-assists', requireIntParam('id'), footballController.getTopAssists);

// G. Teams
footballV1Router.get('/teams/:id', requireIntParam('id'), footballController.getTeamProfile);
footballV1Router.get('/teams/:id/squad', requireIntParam('id'), footballController.getTeamSquad);
footballV1Router.get('/teams/:id/statistics', requireIntParam('id'), footballController.getTeamStatistics);

// H. Players
footballV1Router.get('/players/:id', requireIntParam('id'), footballController.getPlayerProfile);

// I. Other Football Data
footballV1Router.get('/coaches', footballController.getCoaches);
footballV1Router.get('/transfers', footballController.getTransfers);
footballV1Router.get('/injuries', footballController.getInjuries);

footballV1Router.use(footballApiErrorHandler);
