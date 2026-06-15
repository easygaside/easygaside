-- OpenAI-format projects (ChatGPT/DeepSeek) need 'tool' (tool results) and 'system' roles.
alter table egs_messages drop constraint if exists egs_messages_role_check;
alter table egs_messages add constraint egs_messages_role_check
  check (role in ('user', 'assistant', 'tool', 'system'));
