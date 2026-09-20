-- Block format v2 (item 2b): every piece of text - a text or heading block's
-- `data.text`, each item of a list's `data.items` - becomes a list of runs
-- carrying bold, italic and links (app/features/blocks/inline-runs.ts).
--
-- v1 text is already plain and whitespace-collapsed, so wrapping it in one
-- unmarked run is the whole conversion; an empty string becomes no runs.
-- `version` and `updated_at` are left alone: nobody edited these posts.
update entries
set
  blocks = coalesce(
    (
      select jsonb_agg(
        case
          when block ->> 'type' = 'list' then jsonb_set(
            block,
            '{data,items}',
            coalesce(
              (
                select jsonb_agg(
                  case
                    when item #>> '{}' = '' then '[]'::jsonb
                    else jsonb_build_array(jsonb_build_object('text', item))
                  end
                  order by item_position
                )
                from jsonb_array_elements(block -> 'data' -> 'items')
                  with ordinality as list_items (item, item_position)
              ),
              '[]'::jsonb
            )
          )
          else jsonb_set(
            block,
            '{data,text}',
            case
              when block -> 'data' ->> 'text' = '' then '[]'::jsonb
              else jsonb_build_array(jsonb_build_object('text', block -> 'data' -> 'text'))
            end
          )
        end
        order by block_position
      )
      from jsonb_array_elements(blocks) with ordinality as stored_blocks (block, block_position)
    ),
    '[]'::jsonb
  ),
  blocks_format = 'v2'
where blocks_format = 'v1';

alter table entries alter column blocks_format set default 'v2';

-- A write still producing v1 fails here rather than storing a shape the
-- application no longer reads. The next format change replaces this check.
alter table entries add constraint entries_blocks_format_check check (blocks_format = 'v2');
