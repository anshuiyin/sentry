import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import QuestionTooltip from 'app/components/questionTooltip';
import space from 'app/styles/space';

type Props = {
  label: string;
  tooltipInfo: string;
  children: React.ReactNode;
  isFullWidth?: boolean;
};

const DataPrivacyRulesFormField = ({
  label,
  tooltipInfo,
  children,
  isFullWidth,
}: Props) => (
  <Wrapper isFullWidth={isFullWidth}>
    <Label>
      <LabelDescription>{label}</LabelDescription>
      <QuestionTooltip title={tooltipInfo} position="top" size="sm" />
    </Label>
    {children}
  </Wrapper>
);

export default DataPrivacyRulesFormField;

const Wrapper = styled('div')<{isFullWidth?: boolean}>`
  ${p =>
    p.isFullWidth &&
    css`
      grid-column-start: 1;
      grid-column-end: -1;
    `}
`;

const Label = styled('div')`
  display: flex;
  align-items: center;
  margin-bottom: ${space(0.5)};
`;

const LabelDescription = styled('span')`
  margin-right: ${space(1)};
`;
