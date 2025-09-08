| table_name                     | column_name                         | data_type                   |
| ------------------------------ | ----------------------------------- | --------------------------- |
| calendar_events                | id                                  | uuid                        |
| calendar_events                | title                               | character varying           |
| calendar_events                | description                         | text                        |
| calendar_events                | date                                | date                        |
| calendar_events                | start_time                          | time without time zone      |
| calendar_events                | end_time                            | time without time zone      |
| calendar_events                | color                               | character varying           |
| calendar_events                | calendar_type                       | character varying           |
| calendar_events                | user_id                             | uuid                        |
| calendar_events                | project_id                          | uuid                        |
| calendar_events                | task_id                             | uuid                        |
| calendar_events                | created_at                          | timestamp with time zone    |
| calendar_events                | updated_at                          | timestamp with time zone    |
| calendar_events_with_context   | id                                  | uuid                        |
| calendar_events_with_context   | title                               | character varying           |
| calendar_events_with_context   | description                         | text                        |
| calendar_events_with_context   | date                                | date                        |
| calendar_events_with_context   | start_time                          | time without time zone      |
| calendar_events_with_context   | end_time                            | time without time zone      |
| calendar_events_with_context   | color                               | character varying           |
| calendar_events_with_context   | calendar_type                       | character varying           |
| calendar_events_with_context   | user_id                             | uuid                        |
| calendar_events_with_context   | project_id                          | uuid                        |
| calendar_events_with_context   | task_id                             | uuid                        |
| calendar_events_with_context   | created_at                          | timestamp with time zone    |
| calendar_events_with_context   | updated_at                          | timestamp with time zone    |
| calendar_events_with_context   | project_name                        | character varying           |
| calendar_events_with_context   | task_title                          | character varying           |
| calendar_events_with_context   | task_status                         | character varying           |
| calendar_events_with_context   | task_priority                       | character varying           |
| connection_requests            | id                                  | uuid                        |
| connection_requests            | sender_id                           | uuid                        |
| connection_requests            | receiver_id                         | uuid                        |
| connection_requests            | status                              | text                        |
| connection_requests            | created_at                          | timestamp with time zone    |
| connection_requests            | updated_at                          | timestamp with time zone    |
| connections                    | id                                  | uuid                        |
| connections                    | user_a_id                           | uuid                        |
| connections                    | user_b_id                           | uuid                        |
| connections                    | created_at                          | timestamp with time zone    |
| connections                    | status                              | text                        |
| department_chat_messages       | id                                  | uuid                        |
| department_chat_messages       | department_id                       | uuid                        |
| department_chat_messages       | sender_id                           | uuid                        |
| department_chat_messages       | content                             | text                        |
| department_chat_messages       | created_at                          | timestamp with time zone    |
| department_chat_messages       | updated_at                          | timestamp with time zone    |
| department_members             | id                                  | uuid                        |
| department_members             | department_id                       | uuid                        |
| department_members             | user_id                             | uuid                        |
| department_members             | created_at                          | timestamp with time zone    |
| department_members             | updated_at                          | timestamp with time zone    |
| department_members             | role                                | USER-DEFINED                |
| department_members             | department_role                     | text                        |
| department_updates             | id                                  | uuid                        |
| department_updates             | department_id                       | uuid                        |
| department_updates             | author_id                           | uuid                        |
| department_updates             | content                             | text                        |
| department_updates             | created_at                          | timestamp with time zone    |
| department_updates             | updated_at                          | timestamp with time zone    |
| departments                    | id                                  | uuid                        |
| departments                    | team_id                             | uuid                        |
| departments                    | name                                | character varying           |
| departments                    | description                         | text                        |
| departments                    | created_at                          | timestamp with time zone    |
| departments                    | updated_at                          | timestamp with time zone    |
| email_notifications_queue      | id                                  | uuid                        |
| email_notifications_queue      | user_id                             | uuid                        |
| email_notifications_queue      | notification_id                     | uuid                        |
| email_notifications_queue      | email_address                       | text                        |
| email_notifications_queue      | subject                             | text                        |
| email_notifications_queue      | body                                | text                        |
| email_notifications_queue      | template_name                       | text                        |
| email_notifications_queue      | template_data                       | jsonb                       |
| email_notifications_queue      | status                              | text                        |
| email_notifications_queue      | attempts                            | integer                     |
| email_notifications_queue      | max_attempts                        | integer                     |
| email_notifications_queue      | scheduled_for                       | timestamp with time zone    |
| email_notifications_queue      | sent_at                             | timestamp with time zone    |
| email_notifications_queue      | failed_at                           | timestamp with time zone    |
| email_notifications_queue      | error_message                       | text                        |
| email_notifications_queue      | created_at                          | timestamp with time zone    |
| email_notifications_queue      | updated_at                          | timestamp with time zone    |
| focus_sessions                 | id                                  | uuid                        |
| focus_sessions                 | user_id                             | uuid                        |
| focus_sessions                 | date                                | date                        |
| focus_sessions                 | duration_ms                         | integer                     |
| focus_sessions                 | created_at                          | timestamp with time zone    |
| messages                       | id                                  | uuid                        |
| messages                       | sender_id                           | uuid                        |
| messages                       | receiver_id                         | uuid                        |
| messages                       | content                             | text                        |
| messages                       | created_at                          | timestamp with time zone    |
| messages                       | updated_at                          | timestamp with time zone    |
| messages                       | is_read                             | boolean                     |
| messages                       | message_type                        | character varying           |
| notes                          | id                                  | uuid                        |
| notes                          | user_id                             | uuid                        |
| notes                          | title                               | text                        |
| notes                          | content                             | text                        |
| notes                          | category                            | text                        |
| notes                          | tags                                | ARRAY                       |
| notes                          | is_favorite                         | boolean                     |
| notes                          | url                                 | text                        |
| notes                          | author                              | text                        |
| notes                          | attendees                           | ARRAY                       |
| notes                          | action_items                        | ARRAY                       |
| notes                          | created_at                          | timestamp with time zone    |
| notes                          | updated_at                          | timestamp with time zone    |
| notes                          | parent_id                           | uuid                        |
| notification_preferences       | id                                  | uuid                        |
| notification_preferences       | user_id                             | uuid                        |
| notification_preferences       | email_notifications                 | boolean                     |
| notification_preferences       | push_notifications                  | boolean                     |
| notification_preferences       | browser_notifications               | boolean                     |
| notification_preferences       | task_assigned_email                 | boolean                     |
| notification_preferences       | task_assigned_push                  | boolean                     |
| notification_preferences       | task_completed_email                | boolean                     |
| notification_preferences       | task_completed_push                 | boolean                     |
| notification_preferences       | task_due_soon_email                 | boolean                     |
| notification_preferences       | task_due_soon_push                  | boolean                     |
| notification_preferences       | task_deadline_reminder_email        | boolean                     |
| notification_preferences       | task_deadline_reminder_push         | boolean                     |
| notification_preferences       | team_member_added_email             | boolean                     |
| notification_preferences       | team_member_added_push              | boolean                     |
| notification_preferences       | team_member_left_email              | boolean                     |
| notification_preferences       | team_member_left_push               | boolean                     |
| notification_preferences       | team_admin_added_email              | boolean                     |
| notification_preferences       | team_admin_added_push               | boolean                     |
| notification_preferences       | team_ownership_transferred_email    | boolean                     |
| notification_preferences       | team_ownership_transferred_push     | boolean                     |
| notification_preferences       | project_member_added_email          | boolean                     |
| notification_preferences       | project_member_added_push           | boolean                     |
| notification_preferences       | project_ownership_transferred_email | boolean                     |
| notification_preferences       | project_ownership_transferred_push  | boolean                     |
| notification_preferences       | message_received_email              | boolean                     |
| notification_preferences       | message_received_push               | boolean                     |
| notification_preferences       | chat_mention_email                  | boolean                     |
| notification_preferences       | chat_mention_push                   | boolean                     |
| notification_preferences       | call_incoming_email                 | boolean                     |
| notification_preferences       | call_incoming_push                  | boolean                     |
| notification_preferences       | call_missed_email                   | boolean                     |
| notification_preferences       | call_missed_push                    | boolean                     |
| notification_preferences       | system_update_email                 | boolean                     |
| notification_preferences       | system_update_push                  | boolean                     |
| notification_preferences       | reminder_email                      | boolean                     |
| notification_preferences       | reminder_push                       | boolean                     |
| notification_preferences       | created_at                          | timestamp with time zone    |
| notification_preferences       | updated_at                          | timestamp with time zone    |
| notifications                  | id                                  | uuid                        |
| notifications                  | user_id                             | uuid                        |
| notifications                  | type                                | text                        |
| notifications                  | title                               | text                        |
| notifications                  | message                             | text                        |
| notifications                  | is_read                             | boolean                     |
| notifications                  | is_deleted                          | boolean                     |
| notifications                  | action_url                          | text                        |
| notifications                  | action_text                         | text                        |
| notifications                  | metadata                            | jsonb                       |
| notifications                  | created_at                          | timestamp with time zone    |
| notifications                  | updated_at                          | timestamp with time zone    |
| notifications                  | read                                | boolean                     |
| project_department_assignments | id                                  | uuid                        |
| project_department_assignments | project_id                          | uuid                        |
| project_department_assignments | department_id                       | uuid                        |
| project_department_assignments | assigned_by                         | uuid                        |
| project_department_assignments | assigned_at                         | timestamp with time zone    |
| project_members                | id                                  | uuid                        |
| project_members                | project_id                          | uuid                        |
| project_members                | user_id                             | uuid                        |
| project_members                | role                                | character varying           |
| project_members                | joined_at                           | timestamp with time zone    |
| project_members                | created_at                          | timestamp with time zone    |
| project_members                | updated_at                          | timestamp with time zone    |
| project_resources              | id                                  | uuid                        |
| project_resources              | project_id                          | uuid                        |
| project_resources              | name                                | text                        |
| project_resources              | type                                | text                        |
| project_resources              | url                                 | text                        |
| project_resources              | uploaded_by_user_id                 | uuid                        |
| project_resources              | description                         | text                        |
| project_resources              | size_bytes                          | integer                     |
| project_resources              | created_at                          | timestamp with time zone    |
| project_resources              | original_resource_id                | uuid                        |
| project_updates                | id                                  | uuid                        |
| project_updates                | project_id                          | uuid                        |
| project_updates                | author_id                           | uuid                        |
| project_updates                | content                             | text                        |
| project_updates                | type                                | text                        |
| project_updates                | related_task_id                     | uuid                        |
| project_updates                | created_at                          | timestamp with time zone    |
| projects                       | id                                  | uuid                        |
| projects                       | name                                | character varying           |
| projects                       | description                         | text                        |
| projects                       | created_at                          | timestamp with time zone    |
| projects                       | updated_at                          | timestamp with time zone    |
| projects                       | user_id                             | uuid                        |
| projects                       | due_date                            | date                        |
| projects                       | priority                            | text                        |
| projects                       | owner_id                            | uuid                        |
| projects                       | team_id                             | uuid                        |
| projects                       | scope_type                          | character varying           |
| projects                       | visibility                          | character varying           |
| projects                       | photo_url                           | text                        |
| projects                       | department_id                       | uuid                        |
| push_subscriptions             | id                                  | uuid                        |
| push_subscriptions             | user_id                             | uuid                        |
| push_subscriptions             | endpoint                            | text                        |
| push_subscriptions             | auth                                | text                        |
| push_subscriptions             | p256dh                              | text                        |
| push_subscriptions             | user_agent                          | text                        |
| push_subscriptions             | is_active                           | boolean                     |
| push_subscriptions             | created_at                          | timestamp with time zone    |
| push_subscriptions             | updated_at                          | timestamp with time zone    |
| resource_shares                | id                                  | uuid                        |
| resource_shares                | resource_id                         | uuid                        |
| resource_shares                | shared_by_user_id                   | uuid                        |
| resource_shares                | shared_with_user_id                 | uuid                        |
| resource_shares                | permissions                         | text                        |
| resource_shares                | created_at                          | timestamp with time zone    |
| resources                      | id                                  | uuid                        |
| resources                      | bucket_name                         | text                        |
| resources                      | file_name                           | text                        |
| resources                      | file_path                           | text                        |
| resources                      | mime_type                           | text                        |
| resources                      | size_bytes                          | bigint                      |
| resources                      | resource_type                       | text                        |
| resources                      | uploaded_by                         | uuid                        |
| resources                      | created_at                          | timestamp with time zone    |
| resources                      | project_id                          | uuid                        |
| resources                      | team_id                             | uuid                        |
| resources                      | parent_folder_id                    | uuid                        |
| resources                      | starred                             | boolean                     |
| resources                      | shared_link_id                      | uuid                        |
| resources                      | last_accessed_at                    | timestamp with time zone    |
| resources                      | updated_at                          | timestamp with time zone    |
| resources                      | is_team_photo                       | boolean                     |
| task_tags                      | id                                  | uuid                        |
| task_tags                      | task_id                             | uuid                        |
| task_tags                      | tag_name                            | character varying           |
| task_tags                      | created_at                          | timestamp with time zone    |
| tasks                          | id                                  | uuid                        |
| tasks                          | title                               | character varying           |
| tasks                          | description                         | text                        |
| tasks                          | due_date                            | date                        |
| tasks                          | priority                            | character varying           |
| tasks                          | status                              | character varying           |
| tasks                          | progress                            | integer                     |
| tasks                          | project_id                          | uuid                        |
| tasks                          | created_at                          | timestamp with time zone    |
| tasks                          | updated_at                          | timestamp with time zone    |
| tasks                          | user_id                             | uuid                        |
| tasks                          | assigner_id                         | uuid                        |
| tasks                          | assigned_to                         | uuid                        |
| tasks                          | completed_at                        | timestamp with time zone    |
| tasks                          | dependencies                        | ARRAY                       |
| team_chat_messages             | id                                  | uuid                        |
| team_chat_messages             | team_id                             | uuid                        |
| team_chat_messages             | sender_id                           | uuid                        |
| team_chat_messages             | content                             | text                        |
| team_chat_messages             | created_at                          | timestamp with time zone    |
| team_chat_messages             | updated_at                          | timestamp with time zone    |
| team_invites                   | id                                  | uuid                        |
| team_invites                   | team_id                             | uuid                        |
| team_invites                   | created_by                          | uuid                        |
| team_invites                   | expires_at                          | timestamp with time zone    |
| team_invites                   | uses_left                           | integer                     |
| team_invites                   | role                                | character varying           |
| team_invites                   | created_at                          | timestamp with time zone    |
| team_invites                   | updated_at                          | timestamp with time zone    |
| team_invites                   | invite_code                         | text                        |
| team_members                   | id                                  | uuid                        |
| team_members                   | team_id                             | uuid                        |
| team_members                   | user_id                             | uuid                        |
| team_members                   | email                               | text                        |
| team_members                   | role                                | text                        |
| team_members                   | permissions                         | ARRAY                       |
| team_members                   | tags                                | ARRAY                       |
| team_members                   | invited                             | boolean                     |
| team_members                   | accepted                            | boolean                     |
| team_members                   | created_at                          | timestamp without time zone |
| team_members                   | updated_at                          | timestamp without time zone |
| team_members                   | invite_token                        | uuid                        |
| team_members                   | joined_at                           | timestamp with time zone    |
| team_updates                   | id                                  | uuid                        |
| team_updates                   | team_id                             | uuid                        |
| team_updates                   | author_id                           | uuid                        |
| team_updates                   | content                             | text                        |
| team_updates                   | created_at                          | timestamp with time zone    |
| team_updates                   | updated_at                          | timestamp with time zone    |
| teams                          | id                                  | uuid                        |
| teams                          | name                                | character varying           |
| teams                          | description                         | text                        |
| teams                          | owner_id                            | uuid                        |
| teams                          | created_at                          | timestamp with time zone    |
| teams                          | updated_at                          | timestamp with time zone    |
| teams                          | icon_seed                           | character varying           |
| teams                          | photo_url                           | text                        |
| user_connections               | id                                  | uuid                        |
| user_connections               | user_a_id                           | uuid                        |
| user_connections               | user_b_id                           | uuid                        |
| user_connections               | status                              | text                        |
| user_connections               | created_at                          | timestamp with time zone    |
| user_connections               | user_a_name                         | text                        |
| user_connections               | user_a_email                        | text                        |
| user_connections               | user_b_name                         | text                        |
| user_connections               | user_b_email                        | text                        |
| user_notification_summary      | user_id                             | uuid                        |
| user_notification_summary      | total_notifications                 | bigint                      |
| user_notification_summary      | unread_count                        | bigint                      |
| user_notification_summary      | task_notifications                  | bigint                      |
| user_notification_summary      | team_notifications                  | bigint                      |
| user_notification_summary      | call_notifications                  | bigint                      |
| user_notification_summary      | last_notification_at                | timestamp with time zone    |
| user_profiles                  | id                                  | uuid                        |
| user_profiles                  | email                               | text                        |
| user_profiles                  | full_name                           | text                        |
| user_profiles                  | avatar_url                          | text                        |
| user_profiles                  | created_at                          | timestamp with time zone    |
| user_profiles                  | updated_at                          | timestamp with time zone    |
| user_project_memberships       | project_id                          | uuid                        |
| user_project_memberships       | user_id                             | uuid                        |
| user_project_memberships       | role                                | character varying           |

| conname                                           | referenced_table             | source_table                       |
| ------------------------------------------------- | ---------------------------- | ---------------------------------- |
| objects_bucketId_fkey                             | storage.buckets              | storage.objects                    |
| identities_user_id_fkey                           | auth.users                   | auth.identities                    |
| notification_preferences_user_id_fkey             | auth.users                   | notification_preferences           |
| sessions_user_id_fkey                             | auth.users                   | auth.sessions                      |
| refresh_tokens_session_id_fkey                    | auth.sessions                | auth.refresh_tokens                |
| mfa_factors_user_id_fkey                          | auth.users                   | auth.mfa_factors                   |
| mfa_challenges_auth_factor_id_fkey                | auth.mfa_factors             | auth.mfa_challenges                |
| mfa_amr_claims_session_id_fkey                    | auth.sessions                | auth.mfa_amr_claims                |
| sso_domains_sso_provider_id_fkey                  | auth.sso_providers           | auth.sso_domains                   |
| saml_providers_sso_provider_id_fkey               | auth.sso_providers           | auth.saml_providers                |
| saml_relay_states_sso_provider_id_fkey            | auth.sso_providers           | auth.saml_relay_states             |
| saml_relay_states_flow_state_id_fkey              | auth.flow_state              | auth.saml_relay_states             |
| one_time_tokens_user_id_fkey                      | auth.users                   | auth.one_time_tokens               |
| resource_shares_shared_by_user_id_fkey            | user_profiles                | resource_shares                    |
| s3_multipart_uploads_bucket_id_fkey               | storage.buckets              | storage.s3_multipart_uploads       |
| s3_multipart_uploads_parts_upload_id_fkey         | storage.s3_multipart_uploads | storage.s3_multipart_uploads_parts |
| s3_multipart_uploads_parts_bucket_id_fkey         | storage.buckets              | storage.s3_multipart_uploads_parts |
| tasks_project_id_fkey                             | projects                     | tasks                              |
| task_tags_task_id_fkey                            | tasks                        | task_tags                          |
| tasks_assigned_to_fkey                            | auth.users                   | tasks                              |
| resource_shares_resource_id_fkey                  | resources                    | resource_shares                    |
| resource_shares_shared_with_user_id_fkey          | user_profiles                | resource_shares                    |
| notifications_user_id_fkey                        | auth.users                   | notifications                      |
| team_invites_team_id_fkey                         | teams                        | team_invites                       |
| team_invites_created_by_fkey                      | auth.users                   | team_invites                       |
| team_updates_team_id_fkey                         | teams                        | team_updates                       |
| team_updates_author_id_fkey                       | auth.users                   | team_updates                       |
| team_chat_messages_team_id_fkey                   | teams                        | team_chat_messages                 |
| team_chat_messages_sender_id_fkey                 | auth.users                   | team_chat_messages                 |
| department_updates_department_id_fkey             | departments                  | department_updates                 |
| department_updates_author_id_fkey                 | auth.users                   | department_updates                 |
| department_chat_messages_department_id_fkey       | departments                  | department_chat_messages           |
| department_chat_messages_sender_id_fkey           | auth.users                   | department_chat_messages           |
| projects_department_id_fkey                       | departments                  | projects                           |
| email_notifications_queue_user_id_fkey            | auth.users                   | email_notifications_queue          |
| email_notifications_queue_notification_id_fkey    | notifications                | email_notifications_queue          |
| prefixes_bucketId_fkey                            | storage.buckets              | storage.prefixes                   |
| tasks_user_id_fkey                                | auth.users                   | tasks                              |
| project_department_assignments_project_id_fkey    | projects                     | project_department_assignments     |
| project_department_assignments_department_id_fkey | departments                  | project_department_assignments     |
| project_department_assignments_assigned_by_fkey   | auth.users                   | project_department_assignments     |
| fk_calendar_events_user_id                        | auth.users                   | calendar_events                    |
| fk_calendar_events_project_id                     | projects                     | calendar_events                    |
| fk_calendar_events_task_id                        | tasks                        | calendar_events                    |
| projects_user_id_fkey                             | auth.users                   | projects                           |
| connection_requests_sender_id_fkey                | auth.users                   | connection_requests                |
| connection_requests_receiver_id_fkey              | auth.users                   | connection_requests                |
| connections_user_a_id_fkey                        | auth.users                   | connections                        |
| connections_user_b_id_fkey                        | auth.users                   | connections                        |
| tasks_assigner_id_fkey                            | auth.users                   | tasks                              |
| fk_tasks_user_profile                             | user_profiles                | tasks                              |
| notes_user_id_fkey                                | auth.users                   | notes                              |
| resources_uploaded_by_fkey                        | auth.users                   | resources                          |
| fk_teams_owner_id                                 | auth.users                   | teams                              |
| fk_projects_owner_id                              | auth.users                   | projects                           |
| fk_project_members_project_id                     | projects                     | project_members                    |
| fk_project_members_user_id                        | auth.users                   | project_members                    |
| fk_projects_team_id                               | teams                        | projects                           |
| department_members_department_id_fkey             | departments                  | department_members                 |
| department_members_user_id_fkey                   | auth.users                   | department_members                 |
| team_members_user_id_fkey                         | auth.users                   | team_members                       |
| user_profiles_id_fkey                             | auth.users                   | user_profiles                      |
| messages_sender_id_fkey                           | auth.users                   | messages                           |
| messages_receiver_id_fkey                         | auth.users                   | messages                           |
| team_members_team_id_fkey                         | teams                        | team_members                       |
| fk_departments_team_id                            | teams                        | departments                        |
| focus_sessions_user_id_fkey                       | auth.users                   | focus_sessions                     |
| project_updates_project_id_fkey                   | projects                     | project_updates                    |
| project_updates_author_id_fkey                    | auth.users                   | project_updates                    |
| project_updates_related_task_id_fkey              | tasks                        | project_updates                    |
| project_resources_project_id_fkey                 | projects                     | project_resources                  |
| project_resources_uploaded_by_user_id_fkey        | auth.users                   | project_resources                  |
| project_resources_original_resource_id_fkey       | resources                    | project_resources                  |
| notes_parent_id_fkey                              | notes                        | notes                              |
| resources_team_id_fkey                            | teams                        | resources                          |
| resources_project_id_fkey                         | projects                     | resources                          |
| resources_parent_folder_id_fkey                   | resources                    | resources                          |
| push_subscriptions_user_id_fkey                   | auth.users                   | push_subscriptions                 |