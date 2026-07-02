const { request } = require("../utils/request");

const normalizeListResult = (data) => {
  if (Array.isArray(data)) {
    return {
      list: data,
      total: data.length,
      page: 1,
      pageSize: data.length,
    };
  }

  data = data || {};

  return {
    list: data.list || [],
    total: data.total || 0,
    page: data.page || 1,
    pageSize: data.pageSize || 20,
  };
};

const getCards = async (params = {}) => {
  const data = await request({
    path: "/cards",
    query: {
      page: params.page || 1,
      pageSize: params.pageSize || 20,
      status: params.status || "all",
      keyword: params.keyword || "",
      tag: params.tag || "",
      sort: params.sort || "updatedAt",
      order: params.order || "desc",
    },
    showLoading: params.showLoading,
  });

  return normalizeListResult(data);
};

const getCard = (id) =>
  request({
    path: `/cards/${id}`,
    showLoading: true,
  });

const createCard = (card) =>
  request({
    path: "/cards",
    method: "POST",
    data: card,
    showLoading: true,
  });

const organizeCard = (id, payload) =>
  request({
    path: `/cards/${id}/organize`,
    method: "POST",
    data: payload,
    showLoading: true,
    timeout: 30000,
  });

const getQuota = () =>
  request({
    path: "/cards/quota",
  });

const updateCard = (id, patch) =>
  request({
    path: `/cards/${id}`,
    method: "PATCH",
    data: patch,
    showLoading: true,
  });

const deleteCard = (id) =>
  request({
    path: `/cards/${id}`,
    method: "DELETE",
    showLoading: true,
  });

const getDeletedCards = async (params = {}) => {
  const data = await request({
    path: "/cards/deleted",
    query: {
      page: params.page || 1,
      pageSize: params.pageSize || 20,
      keyword: params.keyword || "",
      sort: params.sort || "deletedAt",
      order: params.order || "desc",
    },
    showLoading: params.showLoading,
  });

  return normalizeListResult(data);
};

const restoreCard = (id) =>
  request({
    path: `/cards/${id}/restore`,
    method: "PATCH",
    showLoading: true,
  });

const permanentDeleteCard = (id) =>
  request({
    path: `/cards/${id}/permanent`,
    method: "DELETE",
    showLoading: true,
  });

const archiveCard = (id) =>
  request({
    path: `/cards/${id}/archive`,
    method: "PATCH",
    showLoading: true,
  });

const getTags = () =>
  request({
    path: "/cards/tags",
  });

const getPresetTags = () =>
  request({
    path: "/tags/presets",
  });

const getSuggestions = (params = {}) =>
  request({
    path: "/cards/suggestions",
    query: {
      keyword: params.keyword || "",
      limit: params.limit || 8,
    },
  });

const getOverview = () =>
  request({
    path: "/cards/overview",
  });

module.exports = {
  getCards,
  getCard,
  createCard,
  organizeCard,
  getQuota,
  updateCard,
  deleteCard,
  getDeletedCards,
  restoreCard,
  permanentDeleteCard,
  archiveCard,
  getTags,
  getPresetTags,
  getSuggestions,
  getOverview,
};
