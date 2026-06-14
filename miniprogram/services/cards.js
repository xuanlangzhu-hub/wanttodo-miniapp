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

const archiveCard = (id) =>
  request({
    path: `/cards/${id}/archive`,
    method: "PATCH",
    showLoading: true,
  });

module.exports = {
  getCards,
  getCard,
  createCard,
  updateCard,
  deleteCard,
  archiveCard,
};
