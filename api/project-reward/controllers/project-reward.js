"use strict";

const { sanitizeEntity } = require("strapi-utils/lib");

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  getRewardsForProject: async (ctx) => {
    const { id: projectId } = ctx.params;
    const rewardsWithProjects = await strapi
      .query("project-reward")
      .find({ project: projectId });
    return rewardsWithProjects.map((reward) =>
      sanitizeEntity(reward, { model: strapi.models["project-reward"] })
    );
  },
};
