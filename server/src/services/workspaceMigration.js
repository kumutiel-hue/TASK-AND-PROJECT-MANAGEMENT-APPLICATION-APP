import CalendarEvent from "../models/CalendarEvent.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import TeamMember from "../models/TeamMember.js";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";

export async function migrateLegacyWorkspace() {
  const workspace = await Workspace.findOneAndUpdate(
    { slug: "acme" },
    { $setOnInsert: { name: "Acme Workspace", slug: "acme", members: [] } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  const users = await User.find().sort({ createdAt: 1, _id: 1 });
  let hasAdministrator = workspace.members.some((member) => member.role === "Administrator");

  if (!hasAdministrator && workspace.members.length > 0) {
    const earliestUser = users.find((user) =>
      workspace.members.some((member) => member.user.equals(user._id)),
    );
    const earliestMember = earliestUser
      ? workspace.members.find((member) => member.user.equals(earliestUser._id))
      : workspace.members[0];
    earliestMember.role = "Administrator";
    await User.updateOne({ _id: earliestMember.user }, { $set: { role: "Administrator" } });
    hasAdministrator = true;
  }

  for (const [index, user] of users.entries()) {
    const membership = workspace.members.find((member) => member.user.equals(user._id));
    if (membership) {
      if (user.role !== membership.role) {
        user.role = membership.role;
        await user.save();
      }
      continue;
    }

    const role = !hasAdministrator && index === 0 ? "Administrator" : user.role;
    workspace.members.push({ user: user._id, role });
    if (role === "Administrator") hasAdministrator = true;
    if (user.role !== role) {
      user.role = role;
      await user.save();
    }
  }
  await workspace.save();

  await Promise.all([
    Project.updateMany({ workspace: { $exists: false } }, { $set: { workspace: workspace._id } }),
    Task.updateMany({ workspace: { $exists: false } }, { $set: { workspace: workspace._id } }),
    CalendarEvent.updateMany({ workspace: { $exists: false } }, { $set: { workspace: workspace._id } }),
    TeamMember.updateMany(
      { workspace: { $exists: false } },
      { $set: { workspace: workspace._id, status: "Active" } },
    ),
  ]);

  for (const member of workspace.members) {
    const user = users.find((candidate) => candidate._id.equals(member.user));
    if (!user) continue;
    await TeamMember.findOneAndUpdate(
      { workspace: workspace._id, email: user.email },
      {
        $set: {
          workspace: workspace._id,
          account: user._id,
          status: "Active",
          name: user.name,
          email: user.email,
          role: member.role,
        },
      },
      { upsert: true },
    );
  }

  const hasTeamMemberCollection = await TeamMember.db.db
    .listCollections({ name: TeamMember.collection.name }, { nameOnly: true })
    .hasNext();
  if (hasTeamMemberCollection) {
    const indexes = await TeamMember.collection.indexes();
    const globalEmailIndex = indexes.find((index) =>
      index.unique && index.key.email === 1 && Object.keys(index.key).length === 1,
    );
    if (globalEmailIndex) {
      await TeamMember.collection.dropIndex(globalEmailIndex.name);
    }
  } else {
    await TeamMember.createCollection();
  }
  await TeamMember.collection.createIndex({ workspace: 1, email: 1 }, { unique: true });

  return workspace;
}
