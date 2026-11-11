import api from "../api/axios";

export const getAllBranches = () => {
  return api.get("/branches");
};