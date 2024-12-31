import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { postVotesTable } from "~/src/drizzle/tables/postVotes";
import { builder } from "~/src/graphql/builder";
import {
	MutationDeletePostVoteInput,
	mutationDeletePostVoteInputSchema,
} from "~/src/graphql/inputs/MutationDeletePostVoteInput";
import { Post } from "~/src/graphql/types/Post/Post";
import { TalawaGraphQLError } from "~/src/utilities/talawaGraphQLError";

const mutationDeletePostVoteArgumentsSchema = z.object({
	input: mutationDeletePostVoteInputSchema,
});

builder.mutationField("deletePostVote", (t) =>
	t.field({
		args: {
			input: t.arg({
				description: "",
				required: true,
				type: MutationDeletePostVoteInput,
			}),
		},
		description: "Mutation field to delete a post vote.",
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
			} = mutationDeletePostVoteArgumentsSchema.safeParse(args);

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

			const [currentUser, existingCreator, existingPost, existingPostVote] =
				await Promise.all([
					ctx.drizzleClient.query.usersTable.findFirst({
						columns: {
							role: true,
						},
						where: (fields, operators) =>
							operators.eq(fields.id, currentUserId),
					}),
					ctx.drizzleClient.query.usersTable.findFirst({
						where: (fields, operators) =>
							operators.eq(fields.id, parsedArgs.input.creatorId),
					}),
					ctx.drizzleClient.query.postsTable.findFirst({
						with: {
							organization: {
								columns: {},
								with: {
									organizationMembershipsWhereOrganization: {
										columns: {
											role: true,
										},
										where: (fields, operators) =>
											operators.eq(fields.memberId, parsedArgs.input.creatorId),
									},
								},
							},
							postAttachmentsWherePost: true,
						},
						where: (fields, operators) =>
							operators.eq(fields.id, parsedArgs.input.postId),
					}),
					ctx.drizzleClient.query.postVotesTable.findFirst({
						columns: {},
						where: (fields, operators) =>
							operators.and(
								operators.eq(fields.creatorId, parsedArgs.input.creatorId),
								operators.eq(fields.postId, parsedArgs.input.postId),
							),
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

			if (existingPost === undefined && existingCreator === undefined) {
				throw new TalawaGraphQLError({
					extensions: {
						code: "arguments_associated_resources_not_found",
						issues: [
							{
								argumentPath: ["input", "postId"],
							},
							{
								argumentPath: ["input", "creatorId"],
							},
						],
					},
					message: "No associated resources found for the provided arguments.",
				});
			}

			if (existingPost === undefined) {
				throw new TalawaGraphQLError({
					extensions: {
						code: "arguments_associated_resources_not_found",
						issues: [
							{
								argumentPath: ["input", "postId"],
							},
						],
					},
					message: "No associated resources found for the provided arguments.",
				});
			}

			if (existingCreator === undefined) {
				throw new TalawaGraphQLError({
					extensions: {
						code: "arguments_associated_resources_not_found",
						issues: [
							{
								argumentPath: ["input", "creatorId"],
							},
						],
					},
					message: "No associated resources found for the provided arguments.",
				});
			}

			if (existingPostVote === undefined) {
				throw new TalawaGraphQLError({
					extensions: {
						code: "arguments_associated_resources_not_found",
						issues: [
							{
								argumentPath: ["input", "postId"],
							},
							{
								argumentPath: ["input", "creatorId"],
							},
						],
					},
					message: "No associated resources found for the provided arguments.",
				});
			}

			const currentUserOrganizationMembership =
				existingPost.organization.organizationMembershipsWhereOrganization[0];

			if (
				currentUser.role !== "administrator" &&
				(currentUserOrganizationMembership === undefined ||
					(currentUserOrganizationMembership.role !== "administrator" &&
						currentUserId !== parsedArgs.input.creatorId))
			) {
				throw new TalawaGraphQLError({
					extensions: {
						code: "unauthorized_action_on_arguments_associated_resources",
						issues: [
							{
								argumentPath: ["input", "creatorId"],
							},
							{
								argumentPath: ["input", "postId"],
							},
						],
					},
					message:
						"You are not authorized to perform this action on the resources associated to the provided arguments.",
				});
			}

			if (
				currentUser.role !== "administrator" &&
				(currentUserOrganizationMembership === undefined ||
					(currentUserOrganizationMembership.role !== "administrator" &&
						currentUserId !== parsedArgs.input.creatorId))
			) {
				if (currentUserOrganizationMembership === undefined) {
					throw new TalawaGraphQLError({
						extensions: {
							code: "unauthorized_action_on_arguments_associated_resources",
							issues: [
								{
									argumentPath: ["input", "creatorId"],
								},
								{
									argumentPath: ["input", "postId"],
								},
							],
						},
						message:
							"You are not authorized to perform this action on the resources associated to the provided arguments.",
					});
				}

				if (
					currentUserOrganizationMembership.role !== "administrator" ||
					currentUserId !== parsedArgs.input.creatorId
				) {
					throw new TalawaGraphQLError({
						extensions: {
							code: "unauthorized_action_on_arguments_associated_resources",
							issues: [
								{
									argumentPath: ["input", "creatorId"],
								},
								{
									argumentPath: ["input", "postId"],
								},
							],
						},
						message:
							"You are not authorized to perform this action on the resources associated to the provided arguments.",
					});
				}
			}

			const [deletedPostVote] = await ctx.drizzleClient
				.delete(postVotesTable)
				.where(
					and(
						eq(postVotesTable.creatorId, parsedArgs.input.creatorId),
						eq(postVotesTable.postId, parsedArgs.input.postId),
					),
				)
				.returning();

			// Deleted post vote not being returned means that either it was deleted or its `creatorId` or `postId` columns were changed by external entities before this delete operation could take place.
			if (deletedPostVote === undefined) {
				throw new TalawaGraphQLError({
					extensions: {
						code: "unexpected",
					},
					message: "Something went wrong. Please try again.",
				});
			}

			return Object.assign(existingPost, {
				attachments: existingPost.postAttachmentsWherePost,
			});
		},
		type: Post,
	}),
);