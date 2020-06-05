import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t, tct} from 'app/locale';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import {Client} from 'app/api';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import ExternalLink from 'app/components/links/externalLink';
import Button from 'app/components/button';
import {Organization, Project} from 'app/types';

import {defaultSuggestions as sourceDefaultSuggestions} from './sourceSuggestions';
import Dialog from './dialog';
import Content from './content';
import OrganizationRules from './organizationRules';
import submitRules from './submitRules';
import {
  Rule,
  RuleType,
  MethodType,
  EventIdStatus,
  EventId,
  SourceSuggestion,
} from './types';

const ADVANCED_DATASCRUBBING_LINK =
  'https://docs.sentry.io/data-management/advanced-datascrubbing/';

type PiiConfig = {
  type: RuleType;
  pattern: string;
  redaction?: {
    method?: MethodType;
  };
};

type PiiConfigRule = {
  [key: string]: PiiConfig;
};

type Applications = {[key: string]: Array<string>};

type Props = {
  endpoint: string;
  organization: Organization;
  onSubmitSuccess: (resp: Organization | Project) => void;
  projectId?: Project['id'];
  relayPiiConfig?: string;
  additionalContext?: React.ReactNode;
  disabled?: boolean;
};

type State = {
  rules: Array<Rule>;
  savedRules: Array<Rule>;
  sourceSuggestions: Array<SourceSuggestion>;
  eventId: EventId;
  orgRules: Array<Rule>;
  showAddRuleModal?: boolean;
  isProjectLevel?: boolean;
  relayPiiConfig?: string;
};

class DataPrivacyRules extends React.Component<Props, State> {
  state: State = {
    rules: [],
    savedRules: [],
    relayPiiConfig: this.props.relayPiiConfig,
    sourceSuggestions: [],
    eventId: {
      value: '',
    },
    orgRules: [],
    isProjectLevel: this.props.endpoint.includes('projects'),
  };

  componentDidMount() {
    this.loadRules();
    this.loadSourceSuggestions();
    this.loadOrganizationRules();
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (prevState.relayPiiConfig !== this.state.relayPiiConfig) {
      this.loadRules();
    }
  }

  componentWillUnmount() {
    this.api.clear();
  }

  api = new Client();

  loadOrganizationRules = () => {
    const {isProjectLevel} = this.state;
    const {organization} = this.props;

    if (isProjectLevel) {
      try {
        const convertedRules = this.convertRelayPiiConfig(organization.relayPiiConfig);
        this.setState({
          orgRules: convertedRules,
        });
      } catch {
        addErrorMessage(t('Unable to load organization rules'));
      }
    }
  };

  loadRules() {
    try {
      const convertedRules = this.convertRelayPiiConfig(this.state.relayPiiConfig);
      this.setState({
        rules: convertedRules,
        savedRules: convertedRules,
      });
    } catch {
      addErrorMessage(t('Unable to load project rules'));
    }
  }

  // Remap PII config format to something that is more usable in React. Ideally
  // we would stop doing this at some point and make some updates to how we
  // store this configuration on the server.
  //
  // For the time being the PII config format is documented at
  // https://getsentry.github.io/relay/pii-config/
  convertRelayPiiConfig = (relayPiiConfig?: string) => {
    const piiConfig = relayPiiConfig ? JSON.parse(relayPiiConfig) : {};
    const rules: PiiConfigRule = piiConfig.rules || {};
    const applications: Applications = piiConfig.applications || {};
    const convertedRules: Array<Rule> = [];

    for (const application in applications) {
      for (const rule of applications[application]) {
        if (!rules[rule]) {
          // Convert a "built-in" rule like "@anything:remove" to an object {
          //   type: "anything",
          //   method: "remove"
          // }
          if (rule[0] === '@') {
            const [type, method] = rule.slice(1).split(':');
            convertedRules.push({
              id: convertedRules.length,
              type: type as RuleType,
              method: method as MethodType,
              source: application,
            });
          }
          continue;
        }

        const resolvedRule = rules[rule];
        if (resolvedRule.type === RuleType.PATTERN && resolvedRule.pattern) {
          const method = resolvedRule?.redaction?.method;

          convertedRules.push({
            id: convertedRules.length,
            type: RuleType.PATTERN,
            method: method as MethodType,
            source: application,
            customRegex: resolvedRule.pattern,
          });
        }
      }
    }

    return convertedRules;
  };

  loadSourceSuggestions = async () => {
    const {organization, projectId} = this.props;
    const {eventId} = this.state;

    if (!eventId.value) {
      this.setState(prevState => ({
        sourceSuggestions: sourceDefaultSuggestions,
        eventId: {
          ...prevState.eventId,
          status: undefined,
        },
      }));
      return;
    }

    this.setState(prevState => ({
      sourceSuggestions: sourceDefaultSuggestions,
      eventId: {
        ...prevState.eventId,
        status: EventIdStatus.LOADING,
      },
    }));

    try {
      const query: {projectId?: string; eventId: string} = {eventId: eventId.value};
      if (projectId) {
        query.projectId = projectId;
      }
      const rawSuggestions = await this.api.requestPromise(
        `/organizations/${organization.slug}/data-scrubbing-selector-suggestions/`,
        {query}
      );
      const sourceSuggestions: Array<SourceSuggestion> = rawSuggestions.suggestions;

      if (sourceSuggestions && sourceSuggestions.length > 0) {
        this.setState(prevState => ({
          sourceSuggestions,
          eventId: {
            ...prevState.eventId,
            status: EventIdStatus.LOADED,
          },
        }));
        return;
      }

      this.setState(prevState => ({
        sourceSuggestions: sourceDefaultSuggestions,
        eventId: {
          ...prevState.eventId,
          status: EventIdStatus.NOT_FOUND,
        },
      }));
    } catch {
      this.setState(prevState => ({
        eventId: {
          ...prevState.eventId,
          status: EventIdStatus.ERROR,
        },
      }));
    }
  };

  handleSave = async () => {
    const {rules} = this.state;
    const {onSubmitSuccess, endpoint} = this.props;

    try {
      const data = await submitRules(this.api, endpoint, rules);

      addSuccessMessage(t('Successfully saved rule'));

      if (onSubmitSuccess) {
        onSubmitSuccess(data);
      }
    } catch (error) {
      console.log('error', error);
    }
  };

  handleAddRule = (rule: Rule) => {
    console.log('rule', rule);
    // const newRule = {
    //   ...rule,
    //   id: this.state.rules.length,
    // };
    // const rules = [...this.state.rules, newRule];
    // return await this.handleSave(rules).then(result => {
    //   if (!result) {
    //     this.setState({
    //       rules,
    //     });
    //     return undefined;
    //   }
    //   return result;
    // });
  };

  handleUpdateRule = (updatedRule: Rule) => {
    console.log('rule', updatedRule);
    // const rules = this.state.rules.map(rule => {
    //   if (rule.id === updatedRule.id) {
    //     return updatedRule;
    //   }
    //   return rule;
    // });
    // return await this.handleSubmit(rules).then(result => {
    //   if (!result) {
    //     this.setState({
    //       rules,
    //     });
    //     return undefined;
    //   }
    //   return result;
    // });
  };

  handleDeleteRule = async (rulesToBeDeleted: Array<Rule['id']>) => {
    // const rules = this.state.rules.filter(rule => !rulesToBeDeleted.includes(rule.id));
    // await this.handleSubmit(rules).then(result => {
    //   if (!result) {
    //     this.setState({
    //       rules,
    //     });
    //   }
    // });
  };

  handleToggleAddRuleModal = (showAddRuleModal: boolean) => () => {
    this.setState({
      showAddRuleModal,
    });
  };

  handleUpdateEventId = (eventId: string) => {
    this.setState(
      {
        eventId: {
          value: eventId,
        },
      },
      this.loadSourceSuggestions
    );
  };

  render() {
    const {additionalContext, disabled} = this.props;
    const {
      rules,
      sourceSuggestions,
      showAddRuleModal,
      eventId,
      orgRules,
      isProjectLevel,
    } = this.state;

    return (
      <React.Fragment>
        <Panel>
          <PanelHeader>
            <div>{t('Data Privacy Rules')}</div>
          </PanelHeader>
          <PanelAlert type="info">
            {additionalContext}{' '}
            {`${t('The new rules will only apply to upcoming events. ')}`}{' '}
            {tct('For more details, see [linkToDocs].', {
              linkToDocs: (
                <ExternalLink href={ADVANCED_DATASCRUBBING_LINK}>
                  {t('full documentation on data scrubbing')}
                </ExternalLink>
              ),
            })}
          </PanelAlert>
          <PanelBody>
            {isProjectLevel && <OrganizationRules rules={orgRules} />}
            <Content
              rules={rules}
              onDeleteRule={this.handleDeleteRule}
              onUpdateRule={this.handleUpdateRule}
              onUpdateEventId={this.handleUpdateEventId}
              eventId={eventId}
              sourceSuggestions={sourceSuggestions}
              disabled={disabled}
            />
            <PanelAction>
              <Button
                href={ADVANCED_DATASCRUBBING_LINK}
                target="_blank"
                disabled={disabled}
              >
                {t('Read the docs')}
              </Button>
              <Button
                disabled={disabled}
                onClick={this.handleToggleAddRuleModal(true)}
                priority="primary"
              >
                {t('Add Rule')}
              </Button>
            </PanelAction>
          </PanelBody>
        </Panel>
        {showAddRuleModal && (
          <Dialog
            sourceSuggestions={sourceSuggestions}
            onSaveRule={this.handleAddRule}
            onClose={this.handleToggleAddRuleModal(false)}
            onUpdateEventId={this.handleUpdateEventId}
            eventId={eventId}
          />
        )}
      </React.Fragment>
    );
  }
}

export default DataPrivacyRules;

const PanelAction = styled('div')`
  padding: ${space(1)} ${space(2)};
  position: relative;
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: auto auto;
  justify-content: flex-end;
  border-top: 1px solid ${p => p.theme.borderDark};
`;
