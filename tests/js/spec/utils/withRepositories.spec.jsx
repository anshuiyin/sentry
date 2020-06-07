import React from 'react';

import {mount} from 'sentry-test/enzyme';

import RepositoryStore from 'app/stores/repositoryStore';
import withRepositories from 'app/utils/withRepositories';

describe('withRepositories HoC', function() {
  jest.mock('app/actionCreators/repositories', () => ({
    ...jest.requireActual('app/actionCreators/repositories'),
  }));

  const orgSlug = 'myOrg';
  const repoUrl = `/organizations/${orgSlug}/repos/`;

  const api = new MockApiClient();
  const mockData = [{id: '1'}];
  MockApiClient.addMockResponse({
    url: repoUrl,
    body: mockData,
  });

  beforeEach(() => {
    RepositoryStore.init();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.restoreAllMocks();
  });

  it('adds repositories prop', function() {
    RepositoryStore.loadRepositoriesSuccess(mockData);
    const Component = () => null;
    const Container = withRepositories(Component);
    const wrapper = mount(<Container api={api} />);

    const mountedComponent = wrapper.find('Component');
    expect(mountedComponent.prop('repositories')).toEqual(mockData);
    expect(mountedComponent.prop('repositoriesLoading')).toEqual(false);
    expect(mountedComponent.prop('repositoriesError')).toEqual(undefined);
  });

  it('prevents repeated calls', () => {
    const Component = () => null;
    const Container = withRepositories(Component);

    // XXX(leedongwei): We cannot spy on `fetchRepositories` as Jest can't
    // replace the function in the prototype due to createReactClass.
    // As such, I'm using `componentDidMount` as a proxy.
    jest.spyOn(api, 'requestPromise');
    jest.spyOn(Container.prototype, 'componentDidMount');
    // jest.spyOn(Container.prototype, 'fetchRepositories');

    mount(<Container api={api} />);
    mount(<Container api={api} />);
    mount(<Container api={api} />);

    expect(api.requestPromise).toHaveBeenCalledTimes(1);
    expect(Container.prototype.componentDidMount).toHaveBeenCalledTimes(3);
    // expect(Container.prototype.fetchRepositories).toHaveBeenCalledTimes(3);
  });
});
