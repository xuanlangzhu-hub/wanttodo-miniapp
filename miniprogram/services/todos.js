const { request } = require("../utils/request");

const getTodos = (params = {}) =>
  request({
    path: "/todos",
    query: {
      page: params.page || 1,
      pageSize: params.pageSize || 20,
      status: params.status || "all",
      sort: params.sort || "createdAt",
      order: params.order || "desc",
    },
    showLoading: params.showLoading,
  });

const createTodo = (todo) =>
  request({
    path: "/todos",
    method: "POST",
    data: todo,
    showLoading: true,
  });

const updateTodo = (id, patch) =>
  request({
    path: `/todos/${id}`,
    method: "PATCH",
    data: patch,
    showLoading: true,
  });

const deleteTodo = (id) =>
  request({
    path: `/todos/${id}`,
    method: "DELETE",
    showLoading: true,
  });

const batchTodos = (ids, action) =>
  request({
    path: "/todos/batch",
    method: "PATCH",
    data: { ids, action },
    showLoading: true,
  });

module.exports = {
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  batchTodos,
};
