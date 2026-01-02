(function factory(root) {
  const engine = {
    buildBufferLayout,
    buildBufferSignature,
    buildBufferState,
    createLineRequests,
    loadBufferState,
    planStreamDispatch
  };

  if (typeof module === "object" && module.exports) {
    module.exports = engine;
  } else {
    root.PackagingEngine = engine;
  }

  function buildBufferLayout(buffer) {
    if (Array.isArray(buffer?.lanes)) {
      return buffer.lanes.map((lane, laneIndex) => ({
        id: lane.id || `L${laneIndex + 1}`,
        slots: (lane.slots || []).map((slot, slotIndex) => ({
          id: slot.id || `${lane.id || `L${laneIndex + 1}`}-D${slotIndex + 1}`,
          point: slot.point || null,
          laneIndex,
          slotIndex
        }))
      }));
    }
    const lanes = Number(buffer?.lanes || 0);
    const depth = Number(buffer?.depth || 0);
    const layout = [];
    for (let lane = 1; lane <= lanes; lane += 1) {
      const slots = [];
      for (let slot = 1; slot <= depth; slot += 1) {
        slots.push({
          id: `L${lane}-D${slot}`,
          point: null,
          laneIndex: lane - 1,
          slotIndex: slot - 1
        });
      }
      layout.push({ id: `L${lane}`, slots });
    }
    return layout;
  }

  function buildBufferSignature(config) {
    const buffers = config?.buffers || [];
    const ids = buffers.flatMap((buffer) =>
      buildBufferLayout(buffer).flatMap((lane) => lane.slots.map((slot) => `${buffer.id}:${slot.id}`))
    );
    return ids.join("|");
  }

  function buildBufferState(buffer, config) {
    const cells = [];
    const layout = buildBufferLayout(buffer);
    const goodsType = "";
    layout.forEach((lane, laneIndex) => {
      lane.slots.forEach((slot, slotIndex) => {
        cells.push({
          id: slot.id,
          lane: lane.id,
          slot: slotIndex + 1,
          point: slot.point || null,
          stack: 0,
          goodsType
        });
      });
    });
    return cells;
  }

  function loadBufferState(config, savedState, savedSignature) {
    const buffers = config?.buffers || [];
    const base = {};
    buffers.forEach((buffer) => {
      base[buffer.id] = buildBufferState(buffer, config);
    });
    const signature = buildBufferSignature(config);
    if (!savedState || typeof savedState !== "object" || signature !== savedSignature) {
      return { state: base, signature };
    }
    const next = {};
    Object.entries(base).forEach(([bufferId, cells]) => {
      const savedCells = Array.isArray(savedState[bufferId]) ? savedState[bufferId] : [];
      next[bufferId] = cells.map((cell) => {
        const saved = savedCells.find((item) => item.id === cell.id);
        if (!saved) return cell;
        return {
          ...cell,
          stack: Number.isFinite(saved.stack) ? saved.stack : cell.stack,
          goodsType: saved.goodsType || cell.goodsType
        };
      });
    });
    return { state: next, signature };
  }

  function createLineRequests(config, saved) {
    const raw = Array.isArray(saved) ? saved : null;
    const lines = config?.lines || [];
    const groups = config?.goodsGroups || {};
    const defaultPackaging = groups.packaging?.[0] || config.goodsTypes?.[0] || "";
    const defaultReturn = groups.return?.[0] || defaultPackaging;
    if (!raw) {
      return lines.map((line) => ({
        id: line.id,
        supply: { active: false, goodsType: defaultPackaging },
        aux: { active: false },
        output: { active: false },
        waste: { active: false },
        return: { active: false, goodsType: defaultReturn }
      }));
    }
    return lines.map((line) => {
      const savedLine = raw.find((item) => item.id === line.id);
      return {
        id: line.id,
        supply: {
          active: Boolean(savedLine?.supply?.active),
          goodsType: savedLine?.supply?.goodsType || defaultPackaging
        },
        aux: { active: Boolean(savedLine?.aux?.active) },
        output: { active: Boolean(savedLine?.output?.active) },
        waste: { active: Boolean(savedLine?.waste?.active) },
        return: {
          active: Boolean(savedLine?.return?.active),
          goodsType: savedLine?.return?.goodsType || defaultReturn
        }
      };
    });
  }

  function getBufferById(config, bufferId) {
    return config?.buffers?.find((buffer) => buffer.id === bufferId) || null;
  }

  function getPlaceById(config, placeId) {
    return config?.places?.[placeId] || null;
  }

  function findAvailableBufferCell(config, state, bufferId, goodsType, bufferConfig) {
    const buffer = bufferConfig || getBufferById(config, bufferId);
    if (buffer?.allowedGoods && !buffer.allowedGoods.includes(goodsType)) {
      return null;
    }
    const cells = state[bufferId] || [];
    return cells.find((cell) => cell.stack > 0 && cell.goodsType === goodsType);
  }

  function findFreeBufferCell(config, state, bufferId, goodsType, bufferConfig) {
    const buffer = bufferConfig || getBufferById(config, bufferId);
    if (buffer?.allowedGoods && !buffer.allowedGoods.includes(goodsType)) {
      return null;
    }
    const cells = state[bufferId] || [];
    const maxStack = buffer?.maxStack || 1;
    return cells.find((cell) => {
      if (cell.stack >= maxStack) return false;
      if (cell.stack === 0) return true;
      return cell.goodsType === goodsType;
    });
  }

  function cloneBufferState(bufferState) {
    const next = {};
    Object.entries(bufferState || {}).forEach(([bufferId, cells]) => {
      next[bufferId] = cells.map((cell) => ({ ...cell }));
    });
    return next;
  }

  function updateCell(bufferState, bufferId, cellId, updates) {
    const cells = bufferState[bufferId] || [];
    bufferState[bufferId] = cells.map((cell) =>
      cell.id === cellId ? { ...cell, ...updates } : cell
    );
  }

  function planStreamDispatch({ config, bufferState, lineRequests }) {
    const streams = config?.streams || [];
    for (const stream of streams) {
      const routes = stream.routes || [];
      for (const route of routes) {
        const request = (lineRequests || []).find((item) => item.id === route.lineId);
        const requestState = request ? request[stream.trigger] : null;
        if (!requestState || !requestState.active) {
          continue;
        }
        const goodsType =
          stream.goodsTypeMode === "line"
            ? requestState.goodsType
            : route.goodsType || stream.goodsType || config.goodsTypes?.[0] || "";
        if (!goodsType) {
          continue;
        }

        const nextBufferState = cloneBufferState(bufferState || {});
        let pickPoint = null;
        let dropPoint = null;
        let pickId = null;
        let dropId = null;
        let pickedCell = null;
        let dropCell = null;

        if (route.fromBuffer) {
          const buffer = getBufferById(config, route.fromBuffer);
          pickedCell = findAvailableBufferCell(config, nextBufferState, route.fromBuffer, goodsType, buffer);
          if (!pickedCell) continue;
          pickPoint = pickedCell.point;
          pickId = `${route.fromBuffer}:${pickedCell.id}`;
          updateCell(nextBufferState, route.fromBuffer, pickedCell.id, {
            stack: Math.max(pickedCell.stack - 1, 0)
          });
        } else if (route.fromPlace) {
          const place = getPlaceById(config, route.fromPlace);
          pickPoint = place?.point || null;
          pickId = route.fromPlace;
        }

        if (route.toBuffer) {
          const buffer = getBufferById(config, route.toBuffer);
          dropCell = findFreeBufferCell(config, nextBufferState, route.toBuffer, goodsType, buffer);
          if (!dropCell) continue;
          dropPoint = dropCell.point;
          dropId = `${route.toBuffer}:${dropCell.id}`;
          const maxStack = buffer?.maxStack || 1;
          const nextStack = Math.min((dropCell.stack || 0) + 1, maxStack);
          updateCell(nextBufferState, route.toBuffer, dropCell.id, {
            stack: nextStack,
            goodsType: dropCell.stack === 0 ? goodsType : dropCell.goodsType
          });
        } else if (route.toPlace) {
          const place = getPlaceById(config, route.toPlace);
          dropPoint = place?.point || null;
          dropId = route.toPlace;
        }

        if (!pickPoint || !dropPoint) {
          continue;
        }

        const nextLineRequests = (lineRequests || []).map((req) => {
          if (req.id !== route.lineId) return req;
          return { ...req, [stream.trigger]: { ...req[stream.trigger], active: false } };
        });

        return {
          action: {
            streamId: stream.id,
            lineId: route.lineId,
            goodsType,
            pickPoint,
            dropPoint,
            pickId,
            dropId,
            bufferCell: pickedCell?.id || null,
            targetBufferCell: dropCell?.id || null
          },
          nextBufferState,
          nextLineRequests
        };
      }
    }
    return null;
  }
})(typeof window !== "undefined" ? window : globalThis);
