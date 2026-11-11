import api from "../api/axios";

export const getUsers = () => {
  return api.get("/users");
};


export const getEmployees = () => {
  return api.get("/users/employees");
};