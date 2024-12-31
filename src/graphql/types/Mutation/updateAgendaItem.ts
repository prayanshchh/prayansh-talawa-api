import { eq } from "drizzle-orm";
import { z } from "zod";
import { agendaItemsTable } from "~/src/drizzle/tables/agendaItems";
import { builder } from "~/src/graphql/builder";
import {
	MutationUpdateAgendaItemInput,
	mutationUpdateAgendaItemInputSchema,
} from "~/src/graphql/inputs/MutationUpdateAgendaItemInput";
import { AgendaItem } from "~/src/graphql/types/AgendaItem/AgendaItem";
import { isNotNullish } from "~/src/utilities/isNotNullish";
import { TalawaGraphQLError } from "~/src/utilities/talawaGraphQLError";

const mutationUpdateAgendaItemArgumentsSchema = z.object({
	input: mutationUpdateAgendaItemInputSchema,
});

builder.mutationField("updateAgendaItem", (t) =>
	t.field({
		args: {
			input: t.arg({
				description: "",
				required: true,
				type: MutationUpdateAgendaItemInput,
			}),
		},
		description: "Mutation field to update an agenda item.",
		resolve: async (_parent, args, ctx) => {
			if (!ctx.currentClient.isAuthenticated) {
				throw new TalawaGraphQLError({
					extensions: {
						code: "unauthenticated",
					},
					message: "Only authenticated users can perform this action.",
				});
			}

			const {
				data: parsedArgs,
				error,
				success,
			} = mutationUpdateAgendaItemArgumentsSchema.safeParse(args);

			if (!success) {
				throw new TalawaGraphQLError({
					extensions: {
						code: "invalid_arguments",
						issues: error.issues.map((issue) => ({
							argumentPath: issue.path,
							message: issue.message,
						})),
					},
					message: "Invalid arguments provided.",
				});
			}

			const currentUserId = ctx.currentClient.user.id;

			const [currentUser, existingAgendaItem] = await Promise.all([
				ctx.drizzleClient.query.usersTable.findFirst({
					columns: {
						role: true,
					},
					where: (fields, operators) => operators.eq(fields.id, currentUserId),
				}),
				ctx.drizzleClient.query.agendaItemsTable.findFirst({
					columns: {
						type: true,
					},
					with: {
						folder: {
							columns: {
								eventId: true,
							},
							with: {
								event: {
									columns: {},
									with: {
										organization: {
											columns: {},
											with: {
												organizationMembershipsWhereOrganization: {
													columns: {
														role: true,
													},
													where: (fields, operators) =>
														operators.eq(fields.memberId, currentUserId),
												},
											},
										},
									},
								},
							},
						},
					},
					where: (fields, operators) =>
						operators.eq(fields.id, parsedArgs.input.id),
				}),
			]);

			if (currentUser === undefined) {
				throw new TalawaGraphQLError({
					extensions: {
						code: "unauthenticated",
					},
					message: "Only authenticated users can perform this action.",
				});
			}

			if (existingAgendaItem === undefined) {
				throw new TalawaGraphQLError({
					extensions: {
						code: "arguments_associated_resources_not_found",
						issues: [
							{
								argumentPath: ["input", "id"],
							},
						],
					},
					message: "No associated resources found for the provided arguments.",
				});
			}

			if (existingAgendaItem.type === "note") {
				if (
					parsedArgs.input.duration !== undefined &&
					parsedArgs.input.key !== undefined
				) {
					throw new TalawaGraphQLError({
						extensions: {
							code: "forbidden_action_on_arguments_associated_resources",
							issues: [
								{
									argumentPath: ["input", "duration"],
									message: `Cannot be provided for an agenda item of type "${existingAgendaItem.type}"`,
								},
								{
									argumentPath: ["input", "key"],
									message: `Cannot be provided for an agenda item of type "${existingAgendaItem.type}"`,
								},
							],
						},
						message:
							"This action is forbidden on the resources associated to the provided arguments.",
					});
				}

				if (parsedArgs.input.duration !== undefined) {
					throw new TalawaGraphQLError({
						extensions: {
							code: "forbidden_action_on_arguments_associated_resources",
							issues: [
								{
									argumentPath: ["input", "duration"],
									message: `Cannot be provided for an agenda item of type "${existingAgendaItem.type}"`,
								},
							],
						},
						message:
							"This action is forbidden on the resources associated to the provided arguments.",
					});
				}

				if (parsedArgs.input.key !== undefined) {
					throw new TalawaGraphQLError({
						extensions: {
							code: "forbidden_action_on_arguments_associated_resources",
							issues: [
								{
									argumentPath: ["input", "key"],
									message: `Cannot be provided for an agenda item of type "${existingAgendaItem.type}"`,
								},
							],
						},
						message:
							"This action is forbidden on the resources associated to the provided arguments.",
					});
				}
			}

			if (
				(existingAgendaItem.type === "general" ||
					existingAgendaItem.type === "scripture") &&
				parsedArgs.input.key !== undefined
			) {
				throw new TalawaGraphQLError({
					extensions: {
						code: "forbidden_action_on_arguments_associated_resources",
						issues: [
							{
								argumentPath: ["input", "key"],
								message: `Cannot be provided for an agenda item of type "${existingAgendaItem.type}"`,
							},
						],
					},
					message:
						"This action is forbidden on the resources associated to the provided arguments.",
				});
			}

			if (isNotNullish(parsedArgs.input.folderId)) {
				const folderId = parsedArgs.input.folderId;

				const existingAgendaFolder =
					await ctx.drizzleClient.query.agendaFoldersTable.findFirst({
						columns: {
							eventId: true,
							isAgendaItemFolder: true,
						},
						where: (fields, operators) => operators.eq(fields.id, folderId),
					});

				if (existingAgendaFolder === undefined) {
					throw new TalawaGraphQLError({
						extensions: {
							code: "arguments_associated_resources_not_found",
							issues: [
								{
									argumentPath: ["input", "folderId"],
								},
							],
						},
						message:
							"No associated resources found for the provided arguments.",
					});
				}

				if (
					existingAgendaFolder.eventId !== existingAgendaItem.folder.eventId
				) {
					throw new TalawaGraphQLError({
						extensions: {
							code: "forbidden_action_on_arguments_associated_resources",
							issues: [
								{
									argumentPath: ["input", "folderId"],
									message:
										"This agenda folder is not associated to the event associated to the agenda item.",
								},
							],
						},
						message:
							"This action is forbidden on the resources associated to the provided arguments.",
					});
				}

				if (!existingAgendaFolder.isAgendaItemFolder) {
					throw new TalawaGraphQLError({
						extensions: {
							code: "forbidden_action_on_arguments_associated_resources",
							issues: [
								{
									argumentPath: ["input", "folderId"],
									message:
										"This agenda folder cannot be a folder to agenda items.",
								},
							],
						},
						message:
							"This action is forbidden on the resources associated to the provided arguments.",
					});
				}
			}

			const currentUserOrganizationMembership =
				existingAgendaItem.folder.event.organization
					.organizationMembershipsWhereOrganization[0];

			if (
				currentUser.role !== "administrator" &&
				(currentUserOrganizationMembership === undefined ||
					currentUserOrganizationMembership.role !== "administrator")
			) {
				throw new TalawaGraphQLError({
					extensions: {
						code: "unauthorized_action_on_arguments_associated_resources",
						issues: [
							{
								argumentPath: ["input", "id"],
							},
						],
					},
					message:
						"You are not authorized to perform this action on the resources associated to the provided arguments.",
				});
			}

			const [updatedAgendaItem] = await ctx.drizzleClient
				.update(agendaItemsTable)
				.set({
					description: parsedArgs.input.description,
					duration: parsedArgs.input.duration,
					folderId: parsedArgs.input.folderId,
					key: parsedArgs.input.key,
					name: parsedArgs.input.name,
					updaterId: currentUserId,
				})
				.where(eq(agendaItemsTable.id, parsedArgs.input.id))
				.returning();

			// Updated agenda item not being returned means that either it was deleted or its `id` column was changed by external entities before this update operation could take place.
			if (updatedAgendaItem === undefined) {
				throw new TalawaGraphQLError({
					extensions: {
						code: "unexpected",
					},
					message: "Something went wrong. Please try again.",
				});
			}

			return updatedAgendaItem;
		},
		type: AgendaItem,
	}),
);