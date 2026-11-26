import express from 'express';
import { CLAN_CREATE_COST_MODS, CLAN_TEXT_COLORS, CLAN_FONT_FAMILIES, CLAN_PERMISSION_DEFS } from '../../shared/config/constants.js';

export function createSocialRouter(db, authMiddleware, multiplayer) {
  const router = express.Router();

  // ================= CLANES (15,000 MODS · 1 CLAN POR PERSONA · CHAT · ROLES · AJUSTES · BANS) =================
  router.get('/clans', async (_req, res) => {
    try {
      const clans = await db.listClans();
      return res.json({
        clans,
        createCostMods: CLAN_CREATE_COST_MODS,
        textColors: CLAN_TEXT_COLORS,
        fontFamilies: CLAN_FONT_FAMILIES,
        permissionDefs: CLAN_PERMISSION_DEFS
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/clans', authMiddleware.requireAuth, async (req, res) => {
    try {
      const { name, tag, description, avatar, joinPolicy, publicReadChat, textColor, fontFamily } = req.body || {};
      const result = await db.createClan(req.userId, { name, tag, description, avatar, joinPolicy, publicReadChat, textColor, fontFamily });
      return res.status(201).json(result);
    } catch (err) {
      return res.status(err.status || 400).json({ code: err.code, error: err.message });
    }
  });

  router.patch('/clans/:id/settings', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.updateClanSettings(req.userId, req.params.id, req.body || {});
      return res.json(result);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  });

  router.post('/clans/:id/join', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.joinClan(req.userId, req.params.id, req.body?.message || '');
      const actor = await db.findUserById(req.userId);
      if (result.pendingApproval && multiplayer?.pushNotification) {
        const approvers = await db.getClanApproverUserIds(req.params.id);
        for (const uid of approvers) {
          multiplayer.pushNotification(uid, {
            type: 'clan_join_request',
            title: '🏰 Solicitud de Clan',
            message: `${actor?.username || 'Un jugador'} solicitó unirse a tu clan [${result.clanTag || ''}].`,
            fromUserId: req.userId,
            fromUsername: actor?.username || 'Jugador',
            data: { clanId: req.params.id, requestId: result.requestId, clanTag: result.clanTag, clanName: result.clanName }
          });
          multiplayer.notifyUser(uid, 'clan:updated', { clanId: req.params.id });
        }
      } else if (result.joined && multiplayer?.notifyUser) {
        const approvers = await db.getClanApproverUserIds(req.params.id);
        for (const uid of approvers) {
          if (uid === req.userId) continue;
          multiplayer.pushNotification(uid, {
            type: 'clan_event',
            title: '🏰 Nuevo Integrante',
            message: `${actor?.username || 'Un jugador'} se unió a tu clan.`,
            fromUserId: req.userId,
            fromUsername: actor?.username || 'Jugador',
            data: { clanId: req.params.id }
          });
          multiplayer.notifyUser(uid, 'clan:updated', { clanId: req.params.id });
        }
      }
      return res.json(result);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  });

  router.post('/clans/leave', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.leaveClan(req.userId);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/clans/:id/requests/:reqId/respond', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.respondClanJoinRequest(req.userId, req.params.id, req.params.reqId, Boolean(req.body?.accept));
      if (result.targetUserId && multiplayer?.pushNotification) {
        multiplayer.pushNotification(result.targetUserId, {
          type: 'clan_request_result',
          title: result.accepted ? '✅ Solicitud de Clan Aceptada' : '✕ Solicitud de Clan Rechazada',
          message: result.accepted
            ? `¡Fuiste aceptado en el clan [${result.clanTag}] ${result.clanName}!`
            : `Tu solicitud para unirte al clan [${result.clanTag}] ${result.clanName} fue rechazada.`,
          data: { clanId: req.params.id, accepted: result.accepted }
        });
        multiplayer.notifyUser(result.targetUserId, 'clan:updated', { clanId: req.params.id });
      }
      return res.json(result);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  });

  router.post('/clans/:id/roles', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.createClanRole(req.userId, req.params.id, req.body || {});
      return res.status(201).json(result);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  });

  router.delete('/clans/:id/roles/:roleId', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.deleteClanRole(req.userId, req.params.id, req.params.roleId);
      return res.json(result);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  });

  router.post('/clans/:id/members/:memberId/role', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.assignClanMemberRole(req.userId, req.params.id, req.params.memberId, req.body?.roleId || null);
      return res.json(result);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  });

  router.post('/clans/:id/members/:memberId/kick', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.kickClanMember(req.userId, req.params.id, req.params.memberId);
      return res.json(result);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  });

  router.post('/clans/:id/members/:memberId/ban', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.banClanMember(req.userId, req.params.id, req.params.memberId, req.body?.reason || '');
      return res.json(result);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  });

  router.post('/clans/:id/bans/:bannedUserId/unban', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.unbanClanMember(req.userId, req.params.id, req.params.bannedUserId);
      return res.json(result);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  });

  router.get('/clans/:id/messages', authMiddleware.optionalAuth, async (req, res) => {
    try {
      const data = await db.getClanMessages(req.userId || null, req.params.id);
      return res.json(data);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  });

  router.post('/clans/:id/messages', authMiddleware.requireAuth, async (req, res) => {
    try {
      const resMsg = await db.sendClanMessage(req.userId, req.params.id, req.body?.content);
      if (multiplayer?.notifyUser && Array.isArray(resMsg.memberIds)) {
        for (const uid of resMsg.memberIds) {
          multiplayer.notifyUser(uid, 'clan:message', resMsg.message);
          if (uid !== req.userId && multiplayer.pushNotification) {
            multiplayer.pushNotification(uid, {
              type: 'clan_message',
              title: '💬 Mensaje de Clan',
              message: `${resMsg.message.senderUsername} escribió en tu clan: "${resMsg.message.content.slice(0, 65)}"`,
              fromUserId: req.userId,
              fromUsername: resMsg.message.senderUsername,
              data: { clanId: req.params.id }
            });
          }
        }
      }
      return res.status(201).json({ ok: true, message: resMsg.message });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  });

  router.delete('/clans/:id/messages/:msgId', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.deleteClanMessage(req.userId, req.params.id, req.params.msgId);
      return res.json(result);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  });

  // ================= AMIGOS =================
  router.get('/friends', authMiddleware.requireAuth, async (req, res) => {
    try {
      const summary = await db.getFriendsSummary(req.userId);
      return res.json(summary);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/friends/request', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.sendFriendRequest(req.userId, req.body?.username);
      if (result.targetUserId && multiplayer?.pushNotification) {
        const actor = await db.findUserById(req.userId);
        multiplayer.pushNotification(result.targetUserId, {
          type: result.autoAccepted ? 'friend_accepted' : 'friend_request',
          title: result.autoAccepted ? '🤝 Nuevo Amigo' : '🤝 Solicitud de Amistad',
          message: result.autoAccepted
            ? `${actor?.username || 'Un jugador'} aceptó tu solicitud de amistad.`
            : `${actor?.username || 'Un jugador'} te envió una solicitud de amistad.`,
          fromUserId: req.userId,
          fromUsername: actor?.username || 'Jugador',
          data: { friendshipId: result.id, fromUserId: req.userId, fromUsername: actor?.username || 'Jugador' }
        });
        multiplayer.notifyUser(result.targetUserId, 'friends:updated', {});
      }
      return res.status(201).json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/friends/:id/accept', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.respondFriendRequest(req.userId, req.params.id, true);
      if (result.requesterId && multiplayer?.pushNotification) {
        const actor = await db.findUserById(req.userId);
        multiplayer.pushNotification(result.requesterId, {
          type: 'friend_accepted',
          title: '🤝 Solicitud Aceptada',
          message: `${actor?.username || 'Un jugador'} aceptó tu solicitud de amistad.`,
          fromUserId: req.userId,
          fromUsername: actor?.username || 'Jugador',
          data: { friendId: req.userId, friendUsername: actor?.username || 'Jugador' }
        });
        multiplayer.notifyUser(result.requesterId, 'friends:updated', {});
      }
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/friends/:id/reject', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.respondFriendRequest(req.userId, req.params.id, false);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.delete('/friends/:id', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.removeFriendship(req.userId, req.params.id);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ================= MENSAJES ENTRE AMIGOS =================
  router.get('/friends/:friendId/messages', authMiddleware.requireAuth, async (req, res) => {
    try {
      const messages = await db.getFriendMessages(req.userId, req.params.friendId);
      return res.json({ messages });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  });

  router.post('/friends/:friendId/messages', authMiddleware.requireAuth, async (req, res) => {
    try {
      const msg = await db.sendFriendMessage(req.userId, req.params.friendId, req.body?.content);
      if (multiplayer?.notifyUser) {
        multiplayer.notifyUser(req.params.friendId, 'friend:message', msg);
      }
      if (multiplayer?.pushNotification) {
        multiplayer.pushNotification(req.params.friendId, {
          type: 'friend_message',
          title: '💬 Mensaje Recibido',
          message: `${msg.senderUsername} te ha escrito: "${msg.content.slice(0, 70)}"`,
          fromUserId: req.userId,
          fromUsername: msg.senderUsername,
          data: { friendId: req.userId, friendUsername: msg.senderUsername }
        });
      }
      return res.status(201).json({ ok: true, message: msg });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  });

  // ================= REPORTES DE HACKS Y CHEATS =================
  router.post('/reports', authMiddleware.requireAuth, async (req, res) => {
    try {
      const { reportedUsername, category, description, matchId } = req.body || {};
      const result = await db.createReport(req.userId, { reportedUsername, category, description, matchId });
      return res.status(201).json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ================= PANEL DE MODERACIÓN (EXCLUSIVO MODERADORES) =================
  router.get('/mod/overview', authMiddleware.requireModerator, async (_req, res) => {
    try {
      const overview = await db.getModeratorOverview();
      return res.json(overview);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/mod/ban', authMiddleware.requireModerator, async (req, res) => {
    try {
      const { userId, reason, durationDays } = req.body || {};
      const result = await db.banUser(req.userId, userId, reason, durationDays);
      if (multiplayer?.disconnectUserById) multiplayer.disconnectUserById(userId);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/mod/adjust-mods', authMiddleware.requireModerator, async (req, res) => {
    try {
      const { userId, deltaMods, reason } = req.body || {};
      const result = await db.adjustUserMods(req.userId, userId, deltaMods, reason);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/mod/unban', authMiddleware.requireModerator, async (req, res) => {
    try {
      const { userId } = req.body || {};
      const result = await db.unbanUser(userId);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/mod/reports/:id/resolve', authMiddleware.requireModerator, async (req, res) => {
    try {
      const { status, resolutionNote } = req.body || {};
      const result = await db.resolveReport(req.userId, req.params.id, { status, resolutionNote });
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/mod/grant-all', authMiddleware.requireOwner, async (req, res) => {
    try {
      const user = await db.grantModeratorEverything(req.userId, { makeOwner: true });
      return res.json({ ok: true, user });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Exclusivo del OWNER: otorgar o quitar rol de Moderador (con opción de todo desbloqueado o NO)
  router.post('/mod/set-moderator', authMiddleware.requireOwner, async (req, res) => {
    try {
      const { userId, isModerator, grantAll = false } = req.body || {};
      const result = await db.setUserModeratorStatus(req.userId, userId, {
        isModerator: Boolean(isModerator),
        grantAll: Boolean(grantAll)
      });
      return res.json(result);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  });

  router.post('/mod/anticheat/:id/dismiss', authMiddleware.requireModerator, async (req, res) => {
    try {
      const result = await db.dismissAntiCheatFlag(req.params.id);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  return router;
}
